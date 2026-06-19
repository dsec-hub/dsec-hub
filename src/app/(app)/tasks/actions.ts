"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { taskBoards, tasks } from "@/db/workspace-schema";
import { assertNotPreviewing, requireModule, requireWrite, type CurrentUser } from "@/lib/dal";
import { canWrite, canWriteTask } from "@/lib/rbac";
import { int, str } from "@/lib/form-data";
import { archiveToken, createToken, snapshotForDelete, snapshotForUpdate } from "@/lib/undo";
import type { ActionResult } from "@/lib/undo-types";
import { logMutation } from "@/lib/usage";
import { DEFAULT_BOARD_COLUMNS } from "@/lib/workspace-options";
import type { TaskParentKind } from "@/lib/workspace-queries";

export type FormState = ActionResult;

/**
 * Authorise a mutation on ONE existing task. Module writers (and admins) may
 * write any task; a member without the tasks write-module may write only the
 * tasks ASSIGNED to them (the "edit your own work" rule). Bounces otherwise.
 */
async function assertTaskWrite(taskId: number): Promise<CurrentUser> {
  const user = await requireModule("tasks");
  const [t] = await db
    .select({ assigneeId: tasks.assigneeId })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);
  if (!t) redirect("/tasks");
  if (!canWriteTask(user.modules, user.writeModules, user.personId, t.assigneeId)) {
    redirect("/dashboard");
  }
  assertNotPreviewing(user);
  return user;
}

// Parent entity → the dashboard module that governs it. Quick-adding a task from
// an entity's detail page requires write to that module (you manage the entity).
const PARENT_MODULE: Record<TaskParentKind, "sponsors" | "events" | "projects"> = {
  sponsor: "sponsors",
  event: "events",
  project: "projects",
};

/**
 * Quick-add a task linked to a parent entity (sponsor/event/project) from that
 * entity's detail page. The task also appears on the global board. One action
 * for all three relations (replaces the old per-entity quickAdd*Task).
 */
export async function quickAddRelatedTask(
  kind: TaskParentKind,
  parentId: number,
  fd: FormData,
): Promise<void> {
  const user = await requireWrite(PARENT_MODULE[kind]);
  const title = str(fd, "title");
  if (!title) return;
  const values: typeof tasks.$inferInsert = { title, status: "To Do" };
  // Which committee owns this task (defaults to the parent's committee in the UI;
  // a single event can route tasks to several committees).
  const committee = str(fd, "committee");
  if (committee) values.committee = committee;
  if (kind === "sponsor") values.relatedSponsorId = parentId;
  else if (kind === "event") values.relatedEventId = parentId;
  else values.relatedProjectId = parentId;
  const [row] = await db.insert(tasks).values(values).returning({ id: tasks.id });
  await logMutation(user, "create", "task", row?.id);
  revalidatePath(`/${PARENT_MODULE[kind]}/${parentId}`);
  revalidateTasks();
}

/**
 * Tick / untick a task from its parent entity's detail page (event/project/
 * sponsor). Authorised by the PARENT module's write — mirrors
 * `quickAddRelatedTask`, since managing a parent's task list is part of managing
 * the parent (and lets the affordance, which is gated on parent-write, never
 * bounce). Sets the same status + completedAt as the board's "Done" move.
 * Returns void: the card is toggled optimistically and a tick is self-reversible
 * (just untick it), so there's no undo toast.
 */
export async function setRelatedTaskDone(
  kind: TaskParentKind,
  parentId: number,
  taskId: number,
  done: boolean,
): Promise<void> {
  const user = await requireWrite(PARENT_MODULE[kind]);
  const now = new Date().toISOString();
  await db
    .update(tasks)
    .set({ status: done ? "Done" : "To Do", completedAt: done ? now : null, updatedAt: now })
    .where(eq(tasks.id, taskId));
  await logMutation(user, "update", "task", taskId);
  revalidatePath(`/${PARENT_MODULE[kind]}/${parentId}`);
  revalidateTasks();
}

/**
 * Hard-delete a task from its parent entity's detail page, returning an undo
 * token so the Sonner toast can restore it. Authorised by the PARENT module's
 * write (mirrors `quickAddRelatedTask`): the people who can add a task to an
 * event/project/sponsor can remove it. The card is dropped optimistically in the
 * UI while this runs in the background.
 */
export async function deleteRelatedTask(
  kind: TaskParentKind,
  parentId: number,
  taskId: number,
): Promise<FormState> {
  const user = await requireWrite(PARENT_MODULE[kind]);
  const undo = await snapshotForDelete("task", taskId);
  await db.delete(tasks).where(eq(tasks.id, taskId));
  await logMutation(user, "delete", "task", taskId);
  revalidatePath(`/${PARENT_MODULE[kind]}/${parentId}`);
  revalidateTasks();
  return { ok: true, message: "Task deleted", undo };
}

function parseTask(fd: FormData) {
  return {
    title: str(fd, "title") ?? "",
    boardId: int(fd, "board_id"),
    status: str(fd, "status") ?? "Backlog",
    priority: str(fd, "priority"),
    assigneeId: int(fd, "assignee_id"),
    committee: str(fd, "committee"),
    dueDate: str(fd, "due_date"),
    description: str(fd, "description"),
    relatedEventId: int(fd, "related_event_id"),
    relatedProjectId: int(fd, "related_project_id"),
  };
}

function revalidateTasks() {
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/");
}

export async function createTask(_prev: FormState, fd: FormData): Promise<FormState> {
  // Members (task readers without write) may create, but only self-assigned.
  const user = await requireModule("tasks");
  assertNotPreviewing(user);
  const fullWrite = canWrite(user.modules, user.writeModules, "tasks");
  const values = parseTask(fd);
  if (!values.title) return { error: "Title is required." };
  if (!fullWrite) values.assigneeId = user.personId; // force self-assignment
  const [row] = await db.insert(tasks).values(values).returning({ id: tasks.id });
  await logMutation(user, "create", "task", row?.id);
  revalidateTasks();
  return { ok: true, message: "Task created", undo: createToken("task", row?.id) };
}

export async function updateTask(
  id: number,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const user = await assertTaskWrite(id);
  const fullWrite = canWrite(user.modules, user.writeModules, "tasks");
  const values = parseTask(fd);
  if (!values.title) return { error: "Title is required." };
  // A member editing their own task can't reassign it away from themselves.
  if (!fullWrite) values.assigneeId = user.personId;
  const undo = await snapshotForUpdate("task", id);
  await db
    .update(tasks)
    .set({ ...values, updatedAt: new Date().toISOString() })
    .where(eq(tasks.id, id));
  await logMutation(user, "update", "task", id);
  revalidateTasks();
  return { ok: true, message: "Task updated", undo };
}

export async function archiveTask(id: number): Promise<FormState> {
  const user = await assertTaskWrite(id);
  const now = new Date().toISOString();
  await db.update(tasks).set({ archived: true, updatedAt: now }).where(eq(tasks.id, id));
  // Cascade-archive any subtasks so children never outlive their parent on the board.
  await db.update(tasks).set({ archived: true, updatedAt: now }).where(eq(tasks.parentTaskId, id));
  await logMutation(user, "archive", "task", id);
  revalidateTasks();
  return { ok: true, message: "Task archived", undo: archiveToken("task", id) };
}

/**
 * Add a subtask (one level only) under a parent the user may write. The child
 * inherits the parent's board + committee. Refuses to nest under a task that is
 * itself a subtask.
 */
export async function createSubtask(parentId: number, fd: FormData): Promise<void> {
  const user = await assertTaskWrite(parentId);
  const fullWrite = canWrite(user.modules, user.writeModules, "tasks");
  const title = str(fd, "title");
  if (!title) return;
  const [parent] = await db
    .select({ boardId: tasks.boardId, committee: tasks.committee, parentTaskId: tasks.parentTaskId })
    .from(tasks)
    .where(eq(tasks.id, parentId))
    .limit(1);
  if (!parent || parent.parentTaskId != null) return; // enforce a single level
  const values: typeof tasks.$inferInsert = {
    title,
    parentTaskId: parentId,
    boardId: parent.boardId,
    committee: parent.committee,
    status: "To Do",
  };
  if (!fullWrite) values.assigneeId = user.personId;
  const [row] = await db.insert(tasks).values(values).returning({ id: tasks.id });
  await logMutation(user, "create", "task", row?.id);
  revalidatePath(`/tasks/${parentId}/edit`);
  revalidateTasks();
}

/** Tick / untick a subtask (sets status + completedAt). */
export async function toggleSubtask(childId: number, done: boolean): Promise<void> {
  const user = await assertTaskWrite(childId);
  const now = new Date().toISOString();
  await db
    .update(tasks)
    .set({ status: done ? "Done" : "To Do", completedAt: done ? now : null, updatedAt: now })
    .where(eq(tasks.id, childId));
  await logMutation(user, "update", "task", childId);
  revalidateTasks();
}

export async function deleteTask(id: number): Promise<FormState> {
  const user = await requireWrite("tasks");
  const undo = await snapshotForDelete("task", id);
  await db.delete(tasks).where(eq(tasks.id, id));
  await logMutation(user, "delete", "task", id);
  revalidateTasks();
  return { ok: true, message: "Task deleted", undo };
}

/**
 * Quick-add from a board column: creates a task with just a title, in the given
 * board (or the Inbox when boardId is null) and status. Used by the inline
 * "+ Add task" affordance on each kanban column.
 */
export async function quickAddTask(
  boardId: number | null,
  status: string,
  fd: FormData,
): Promise<void> {
  const user = await requireModule("tasks");
  assertNotPreviewing(user);
  const fullWrite = canWrite(user.modules, user.writeModules, "tasks");
  const title = str(fd, "title");
  if (!title) return;
  const values: typeof tasks.$inferInsert = { boardId, status, title };
  // Inherit the active committee filter (passed as a hidden field) so a task
  // added in a committee-scoped view is tagged to that committee.
  const committee = str(fd, "committee");
  if (committee) values.committee = committee;
  if (!fullWrite) values.assigneeId = user.personId; // members add self-assigned
  const [row] = await db.insert(tasks).values(values).returning({ id: tasks.id });
  await logMutation(user, "create", "task", row?.id);
  revalidateTasks();
}

export async function createBoard(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireWrite("tasks");
  const name = str(fd, "name") ?? "";
  if (!name) return { error: "Board name is required." };
  const [row] = await db
    .insert(taskBoards)
    .values({
      name,
      description: str(fd, "description"),
      committee: str(fd, "committee"),
      columns: [...DEFAULT_BOARD_COLUMNS],
    })
    .returning({ id: taskBoards.id });
  await logMutation(user, "create", "board", row?.id);
  revalidateTasks();
  return { ok: true, message: "Board created", undo: createToken("board", row?.id) };
}

/** Read the board's columns from the form: trim blanks, drop duplicates, keep
 * the submitted order (DOM order == left-to-right column order). */
function parseColumns(fd: FormData): string[] {
  const cols = fd.getAll("columns").map((c) => String(c).trim()).filter(Boolean);
  return [...new Set(cols)];
}

export async function updateBoard(
  id: number,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const user = await requireWrite("tasks");
  const name = str(fd, "name") ?? "";
  if (!name) return { error: "Board name is required." };
  const columns = parseColumns(fd);
  const undo = await snapshotForUpdate("board", id);
  await db
    .update(taskBoards)
    .set({
      name,
      description: str(fd, "description"),
      committee: str(fd, "committee"),
      columns: columns.length ? columns : [...DEFAULT_BOARD_COLUMNS],
    })
    .where(eq(taskBoards.id, id));
  await logMutation(user, "update", "board", id);
  revalidateTasks();
  return { ok: true, message: "Board updated", undo };
}

/**
 * Move every task on a board back to the Inbox (boardId = null). Called before a
 * board is archived or deleted so its tasks stay visible somewhere — otherwise
 * the board/inbox queries would hide them and they'd silently disappear.
 */
async function detachBoardTasks(boardId: number) {
  await db
    .update(tasks)
    .set({ boardId: null, updatedAt: new Date().toISOString() })
    .where(eq(tasks.boardId, boardId));
}

export async function archiveBoard(id: number): Promise<FormState> {
  const user = await requireWrite("tasks");
  await detachBoardTasks(id);
  await db.update(taskBoards).set({ archived: true }).where(eq(taskBoards.id, id));
  await logMutation(user, "archive", "board", id);
  revalidateTasks();
  return {
    ok: true,
    message: "Board archived — its tasks moved to the Inbox",
    undo: archiveToken("board", id),
  };
}

export async function deleteBoard(id: number): Promise<FormState> {
  const user = await requireWrite("tasks");
  const undo = await snapshotForDelete("board", id);
  await detachBoardTasks(id);
  await db.delete(taskBoards).where(eq(taskBoards.id, id));
  await logMutation(user, "delete", "board", id);
  revalidateTasks();
  return { ok: true, message: "Board deleted — its tasks moved to the Inbox", undo };
}

/**
 * Move a task to a new status column. Called inline from <MoveControl> with the
 * taskId bound, so it reads only `status` from the submitted FormData and does
 * NOT redirect. Setting status to "Done" stamps completedAt; anything else
 * clears it.
 */
export async function moveTask(taskId: number, fd: FormData): Promise<void> {
  await moveTaskTo(taskId, str(fd, "status") ?? "Backlog");
}

/** Programmatic move (used by the drag-and-drop board). */
export async function moveTaskTo(taskId: number, status: string): Promise<void> {
  const user = await assertTaskWrite(taskId);
  const now = new Date().toISOString();
  await db
    .update(tasks)
    .set({
      status,
      completedAt: status === "Done" ? now : null,
      updatedAt: now,
    })
    .where(eq(tasks.id, taskId));
  await logMutation(user, "update", "task", taskId);
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}

/**
 * Generic single-field reassignment used by drag-and-drop on the views board
 * when grouped by status / committee / board / assignee / priority. Authorised
 * per-task via assertTaskWrite (so members can only move their own cards).
 */
export async function reassignTask(taskId: number, dim: string, value: string): Promise<void> {
  const user = await assertTaskWrite(taskId);
  // A member may move their OWN task across status/priority, but reassigning it
  // to another person/board/committee is a management action — full write only.
  const fullWrite = canWrite(user.modules, user.writeModules, "tasks");
  const now = new Date().toISOString();
  const set: Partial<typeof tasks.$inferInsert> = { updatedAt: now };
  switch (dim) {
    case "status":
      set.status = value;
      set.completedAt = value === "Done" ? now : null;
      break;
    case "priority":
      set.priority = value && value !== "__none__" ? value : null;
      break;
    case "committee":
      if (!fullWrite) return;
      set.committee = value && value !== "__none__" ? value : null;
      break;
    case "board":
      if (!fullWrite) return;
      set.boardId = value === "inbox" || value === "" ? null : Number(value) || null;
      break;
    case "assignee":
      if (!fullWrite) return;
      set.assigneeId = value === "__none__" || value === "" ? null : Number(value) || null;
      break;
    default:
      return;
  }
  await db.update(tasks).set(set).where(eq(tasks.id, taskId));
  await logMutation(user, "update", "task", taskId);
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}
