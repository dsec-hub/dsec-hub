import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { appTaskView } from "@/db/schema";
import { events, people, projects, sponsors, taskBoards, tasks } from "@/db/workspace-schema";
import type { SavedView, TaskRow, ViewConfigTV } from "@/lib/task-view-types";

/**
 * The whole non-archived task pool, enriched with the names/ids the views engine
 * filters, groups, and sorts on. One query for the entire Tasks page — the pool
 * for a student club is small enough that client-side lensing is instant. Module
 * gating happens at the page (requireModule "tasks") BEFORE this is called.
 */
export async function getTasksForViews(): Promise<TaskRow[]> {
  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      position: tasks.position,
      priority: tasks.priority,
      dueDate: tasks.dueDate,
      committee: tasks.committee,
      completedAt: tasks.completedAt,
      assigneeId: tasks.assigneeId,
      assigneeName: people.name,
      boardId: tasks.boardId,
      boardName: taskBoards.name,
      parentTaskId: tasks.parentTaskId,
      relatedEventId: tasks.relatedEventId,
      relatedEventName: events.name,
      relatedProjectId: tasks.relatedProjectId,
      relatedProjectName: projects.name,
      relatedSponsorId: tasks.relatedSponsorId,
      relatedSponsorName: sponsors.organisation,
    })
    .from(tasks)
    .leftJoin(people, eq(tasks.assigneeId, people.id))
    .leftJoin(taskBoards, eq(tasks.boardId, taskBoards.id))
    .leftJoin(events, eq(tasks.relatedEventId, events.id))
    .leftJoin(projects, eq(tasks.relatedProjectId, projects.id))
    .leftJoin(sponsors, eq(tasks.relatedSponsorId, sponsors.id))
    .where(eq(tasks.archived, false))
    .orderBy(asc(tasks.position), asc(tasks.id));

  // Roll up subtask progress (children → parent) so cards can show "2/5 done".
  const total = new Map<number, number>();
  const done = new Map<number, number>();
  for (const r of rows) {
    if (r.parentTaskId != null) {
      total.set(r.parentTaskId, (total.get(r.parentTaskId) ?? 0) + 1);
      if (r.completedAt) done.set(r.parentTaskId, (done.get(r.parentTaskId) ?? 0) + 1);
    }
  }
  return rows.map((r) => ({
    ...r,
    subtaskTotal: total.get(r.id) ?? 0,
    subtaskDone: done.get(r.id) ?? 0,
  }));
}

/** Children (subtasks) of a task, for its detail/edit checklist. */
export async function getSubtasks(parentId: number) {
  return db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      completedAt: tasks.completedAt,
      assigneeName: people.name,
    })
    .from(tasks)
    .leftJoin(people, eq(tasks.assigneeId, people.id))
    .where(and(eq(tasks.parentTaskId, parentId), eq(tasks.archived, false)))
    .orderBy(asc(tasks.position), asc(tasks.id));
}

const EMPTY_CONFIG: ViewConfigTV = {
  filter: {},
  groupBy: "status",
  sort: { key: "due", dir: "asc" },
  mode: "list",
};

function rowToSavedView(r: {
  id: number;
  name: string;
  description: string | null;
  config: ViewConfigTV | null;
  sortOrder: number;
}): SavedView {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    config: r.config && typeof r.config === "object" ? r.config : EMPTY_CONFIG,
    sortOrder: r.sortOrder,
  };
}

/** A user's saved task views, in their chosen order. */
export async function getSavedViews(userId: number): Promise<SavedView[]> {
  const rows = await db
    .select({
      id: appTaskView.id,
      name: appTaskView.name,
      description: appTaskView.description,
      config: appTaskView.config,
      sortOrder: appTaskView.sortOrder,
    })
    .from(appTaskView)
    .where(and(eq(appTaskView.userId, userId), eq(appTaskView.archived, false)))
    .orderBy(asc(appTaskView.sortOrder), asc(appTaskView.id));
  return rows.map(rowToSavedView);
}

/** A single saved view, scoped to its owner (returns undefined otherwise). */
export async function getSavedViewById(userId: number, id: number): Promise<SavedView | undefined> {
  const [row] = await db
    .select({
      id: appTaskView.id,
      name: appTaskView.name,
      description: appTaskView.description,
      config: appTaskView.config,
      sortOrder: appTaskView.sortOrder,
    })
    .from(appTaskView)
    .where(and(eq(appTaskView.id, id), eq(appTaskView.userId, userId), eq(appTaskView.archived, false)))
    .limit(1);
  return row ? rowToSavedView(row) : undefined;
}

/** Highest sort_order among a user's views (for appending a new one). */
export async function nextSavedViewOrder(userId: number): Promise<number> {
  const [row] = await db
    .select({ sortOrder: appTaskView.sortOrder })
    .from(appTaskView)
    .where(and(eq(appTaskView.userId, userId), eq(appTaskView.archived, false)))
    .orderBy(desc(appTaskView.sortOrder))
    .limit(1);
  return (row?.sortOrder ?? -1) + 1;
}
