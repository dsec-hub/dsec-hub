"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";

import { Icons } from "@/components/icons";
import { Badge, EmptyState, buttonGhost } from "@/components/ui";
import { cn } from "@/lib/format";
import { showUndoToast } from "@/lib/use-undo-toast";
import { priorityVariant } from "@/lib/workspace-options";
import type { TaskGroup } from "@/lib/task-view-helpers";
import type { TaskGroupBy, TaskRow } from "@/lib/task-view-types";

import { deleteTask, moveTaskTo, quickAddTask, reassignTask } from "./actions";
import { MoveControl } from "./move-control";

/**
 * A local, mutable copy of the server-provided groups that re-syncs whenever the
 * server data changes. Lets a view optimistically drop a card on delete while
 * still reconciling against the next server render — including an undo that
 * restores the row (the card reappears once the server data comes back).
 */
function useLocalGroups(initial: TaskGroup[]) {
  const [groups, setGroups] = useState<TaskGroup[]>(initial);
  const sig = useMemo(
    () => initial.map((g) => `${g.key}:${g.tasks.map((t) => t.id).join(",")}`).join("|"),
    [initial],
  );
  const [prevSig, setPrevSig] = useState(sig);
  if (sig !== prevSig) {
    setPrevSig(sig);
    setGroups(initial);
  }
  return [groups, setGroups] as const;
}

/**
 * Quick-delete affordance on a task card. Removes the card from view immediately
 * (via onRemoved), fires the delete in the background, and surfaces a Sonner
 * "Undo" toast — undoing restores the row server-side and refreshes. Full-write
 * only; hard delete is a management action.
 */
function DeleteCardButton({ taskId, onRemoved }: { taskId: number; onRemoved: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      aria-label="Delete task"
      title="Delete task"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onRemoved();
        start(async () => {
          const res = await deleteTask(taskId);
          showUndoToast(res, () => router.refresh());
        });
      }}
      className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted opacity-60 transition hover:bg-elevated hover:text-danger hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100"
    >
      <Icons.close className="size-3.5" />
    </button>
  );
}

const PRIORITY_DOT: Record<string, string> = {
  Urgent: "bg-danger",
  High: "bg-warning",
  Medium: "bg-accent",
  Low: "bg-muted/50",
};

function canWriteRow(t: TaskRow, fullWrite: boolean, personId: number | null): boolean {
  return fullWrite || (personId != null && t.assigneeId === personId);
}

/** "✓ 2/5" subtask progress, shown only when a task has children. */
function SubtaskChip({ t }: { t: TaskRow }) {
  if (!t.subtaskTotal) return null;
  const complete = t.subtaskDone === t.subtaskTotal;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] tabular-nums",
        complete ? "bg-success/15 text-success" : "bg-elevated text-muted",
      )}
      title={`${t.subtaskDone} of ${t.subtaskTotal} subtasks done`}
    >
      ✓ {t.subtaskDone}/{t.subtaskTotal}
    </span>
  );
}

/** Compact metadata shown under a task title (committee · assignee · due). */
function TaskMeta({ t }: { t: TaskRow }) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
      {t.priority && <Badge variant={priorityVariant(t.priority)}>{t.priority}</Badge>}
      {t.committee && <span className="truncate">{t.committee}</span>}
      {t.assigneeName && <span className="truncate">· {t.assigneeName}</span>}
      {t.dueDate && <span className="tabular-nums">· {t.dueDate}</span>}
      {(t.relatedEventName || t.relatedProjectName) && (
        <span className="truncate text-accent-text">· {t.relatedEventName ?? t.relatedProjectName}</span>
      )}
      <SubtaskChip t={t} />
    </div>
  );
}

// =============================================================================
// Board (kanban) view — columns = the group-by axis, drag to reassign
// =============================================================================

export function GroupedBoard({
  groups: initial,
  groupBy,
  reassignable,
  fullWrite,
  personId,
  canAdd,
  activeBoardId,
  activeCommittee,
}: {
  groups: TaskGroup[];
  groupBy: TaskGroupBy;
  reassignable: boolean;
  fullWrite: boolean;
  personId: number | null;
  canAdd: boolean;
  activeBoardId: number | null;
  activeCommittee: string | null;
}) {
  const [groups, setGroups] = useState<TaskGroup[]>(initial);
  const [dragId, setDragId] = useState<number | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const [, start] = useTransition();

  // Re-sync from server when the underlying data changes (the signature trick
  // keeps optimistic drags from being clobbered between renders).
  const sig = useMemo(
    () => groups.length + "|" + initial.map((g) => `${g.key}:${g.tasks.map((t) => t.id).join(",")}`).join("|"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initial],
  );
  const [prevSig, setPrevSig] = useState(sig);
  if (sig !== prevSig) {
    setPrevSig(sig);
    setGroups(initial);
  }

  function removeCard(id: number) {
    setGroups((gs) => gs.map((g) => ({ ...g, tasks: g.tasks.filter((t) => t.id !== id) })));
  }

  function drop(targetKey: string) {
    const id = dragId;
    setOverKey(null);
    setDragId(null);
    if (id == null || !reassignable) return;
    const from = groups.find((g) => g.tasks.some((t) => t.id === id));
    if (!from || from.key === targetKey) return;

    let moved: TaskRow | undefined;
    const next = groups.map((g) => ({
      ...g,
      tasks: g.tasks.filter((t) => {
        if (t.id === id) {
          moved = t;
          return false;
        }
        return true;
      }),
    }));
    const target = next.find((g) => g.key === targetKey);
    if (moved && target) target.tasks.push(moved);
    setGroups(next);
    start(async () => {
      if (groupBy === "status") await moveTaskTo(id, targetKey);
      else await reassignTask(id, groupBy, targetKey);
    });
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {groups.map((col) => (
        <div
          key={col.key}
          onDragOver={(e) => {
            if (!reassignable) return;
            e.preventDefault();
            setOverKey(col.key);
          }}
          onDragLeave={() => setOverKey((k) => (k === col.key ? null : k))}
          onDrop={() => drop(col.key)}
          className={cn(
            "w-72 shrink-0 rounded-lg p-1.5 transition-colors",
            overKey === col.key && "bg-elevated/60 ring-1 ring-accent/40",
          )}
        >
          <div className="mb-2 flex items-center justify-between px-2">
            <span className="truncate text-sm font-medium">{col.label}</span>
            <span className="rounded-full bg-elevated px-1.5 text-xs tabular-nums text-muted">
              {col.tasks.length}
            </span>
          </div>
          <div className="flex min-h-16 flex-col gap-2">
            {col.tasks.map((t) => {
              const draggable = reassignable && canWriteRow(t, fullWrite, personId);
              return (
                <div
                  key={t.id}
                  draggable={draggable}
                  onDragStart={() => draggable && setDragId(t.id)}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverKey(null);
                  }}
                  className={cn(
                    "group rounded-xl border border-border bg-surface p-3 transition-opacity",
                    draggable && "cursor-grab active:cursor-grabbing",
                    dragId === t.id && "opacity-40",
                  )}
                >
                  <div className="flex items-start gap-2">
                    {t.priority && (
                      <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", PRIORITY_DOT[t.priority] ?? "bg-muted/50")} />
                    )}
                    <Link
                      href={`/tasks/${t.id}/edit`}
                      className="min-w-0 flex-1 text-sm hover:text-accent-text"
                    >
                      {t.title}
                    </Link>
                    {fullWrite && <DeleteCardButton taskId={t.id} onRemoved={() => removeCard(t.id)} />}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                    {t.committee && <span className="truncate">{t.committee}</span>}
                    {t.assigneeName && <span className="truncate">· {t.assigneeName}</span>}
                    {t.dueDate && <span className="tabular-nums">· {t.dueDate}</span>}
                    <SubtaskChip t={t} />
                  </div>
                </div>
              );
            })}
            {canAdd && groupBy === "status" && (
              <QuickAdd status={col.key} boardId={activeBoardId} committee={activeCommittee} />
            )}
          </div>
        </div>
      ))}
      {reassignable && <p className="sr-only">Drag cards between columns to reassign them.</p>}
    </div>
  );
}

/** Inline "add a card" at the bottom of a status column. */
function QuickAdd({
  status,
  boardId,
  committee,
}: {
  status: string;
  boardId: number | null;
  committee: string | null;
}) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg px-2 py-1.5 text-left text-xs text-muted transition-colors hover:bg-elevated hover:text-foreground"
      >
        + Add task
      </button>
    );
  }
  return (
    <form
      ref={formRef}
      action={async (fd) => {
        await quickAddTask(boardId, status, fd);
        formRef.current?.reset();
      }}
      className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface p-2"
    >
      {committee && <input type="hidden" name="committee" value={committee} />}
      <input
        name="title"
        autoFocus
        placeholder="Task title…"
        required
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        className="w-full rounded-md border border-border bg-elevated px-2 py-1.5 text-sm outline-none focus:border-accent"
      />
      <div className="flex items-center gap-1.5">
        <button type="submit" className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
          Add
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md px-2 py-1 text-xs text-muted hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// =============================================================================
// List view — sections per group
// =============================================================================

export function GroupedList({
  groups: initial,
  statuses,
  fullWrite,
  personId,
  ungrouped,
}: {
  groups: TaskGroup[];
  statuses: string[];
  fullWrite: boolean;
  personId: number | null;
  ungrouped: boolean;
}) {
  const [groups, setGroups] = useLocalGroups(initial);
  const removeCard = (id: number) =>
    setGroups((gs) => gs.map((g) => ({ ...g, tasks: g.tasks.filter((t) => t.id !== id) })));
  const total = groups.reduce((n, g) => n + g.tasks.length, 0);
  if (total === 0) {
    return <EmptyState>No tasks match this view. Adjust the filters, or add one from a board.</EmptyState>;
  }
  return (
    <div className="flex flex-col gap-5">
      {groups.map((g) => (
        <section key={g.key} className="overflow-hidden rounded-xl border border-border bg-surface">
          {!ungrouped && (
            <header className="flex items-center gap-2 border-b border-border px-5 py-2.5">
              <h3 className="text-sm font-medium">{g.label}</h3>
              <span className="rounded-full bg-elevated px-1.5 text-xs tabular-nums text-muted">
                {g.tasks.length}
              </span>
            </header>
          )}
          <ul className="divide-y divide-border">
            {g.tasks.map((t) => {
              const writable = canWriteRow(t, fullWrite, personId);
              return (
                <li key={t.id} className="group flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <Link
                      href={`/tasks/${t.id}/edit`}
                      className={cn(
                        "text-sm transition-colors hover:text-accent-text",
                        t.completedAt && "text-muted line-through",
                      )}
                    >
                      {t.title}
                    </Link>
                    <TaskMeta t={t} />
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <MoveControl taskId={t.id} columns={statuses} current={t.status} canWrite={writable} />
                    {writable && (
                      <Link href={`/tasks/${t.id}/edit`} className={buttonGhost}>
                        Edit
                      </Link>
                    )}
                    {fullWrite && <DeleteCardButton taskId={t.id} onRemoved={() => removeCard(t.id)} />}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
