"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";

import { SelectField, TextInput } from "@/components/form";
import { Icons } from "@/components/icons";
import { Badge, EmptyState, SectionCard, buttonGhost } from "@/components/ui";
import { cn, formatDate } from "@/lib/format";
import { showUndoToast } from "@/lib/use-undo-toast";
import { priorityVariant } from "@/lib/workspace-options";
import type { RelatedTaskRow, TaskParentKind } from "@/lib/workspace-queries";

import {
  deleteRelatedTask,
  quickAddRelatedTask,
  setRelatedTaskDone,
} from "@/app/(app)/tasks/actions";

const NOUN: Record<TaskParentKind, string> = {
  sponsor: "sponsor",
  event: "event",
  project: "project",
};

/**
 * A local, mutable copy of the server task list that re-syncs whenever the server
 * data changes (new id, or a flipped done state). Lets a row be ticked or dropped
 * optimistically while still reconciling against the next server render —
 * including an undo that restores a deleted row (it reappears once the refreshed
 * data comes back). Mirrors the board's useLocalGroups.
 */
function useLocalTasks(initial: RelatedTaskRow[]) {
  const [list, setList] = useState(initial);
  const sig = useMemo(
    () => initial.map((t) => `${t.id}:${t.completedAt ? 1 : 0}`).join(","),
    [initial],
  );
  const [prevSig, setPrevSig] = useState(sig);
  if (sig !== prevSig) {
    setPrevSig(sig);
    setList(initial);
  }
  return [list, setList] as const;
}

/**
 * The per-entity task board shown on a sponsor / event / project detail page:
 * the tasks linked to that record, plus a quick-add that tags a new task to it
 * (and surfaces it on the global board too). One component for all three
 * relations — see getRelatedTasks / quickAddRelatedTask.
 *
 * Each row can be ticked off or deleted with snappy, optimistic UX: the change
 * shows instantly, the server action runs in the background, and a delete raises
 * a Sonner "Undo" toast (a tick is self-reversible, so it just persists).
 */
export function RelatedTasks({
  kind,
  parentId,
  tasks,
  canWrite,
  committees,
  defaultCommittee,
}: {
  kind: TaskParentKind;
  parentId: number;
  tasks: RelatedTaskRow[];
  canWrite: boolean;
  /** Committee names for the quick-add picker; omit to hide the picker. */
  committees?: string[];
  /** Pre-selected committee (e.g. the event's own committee). */
  defaultCommittee?: string | null;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [list, setList] = useLocalTasks(tasks);
  const [, start] = useTransition();

  const toggleDone = (task: RelatedTaskRow, done: boolean) => {
    setList((prev) =>
      prev.map((t) =>
        t.id === task.id ? { ...t, completedAt: done ? new Date().toISOString() : null } : t,
      ),
    );
    start(async () => {
      await setRelatedTaskDone(kind, parentId, task.id, done);
    });
  };

  const remove = (task: RelatedTaskRow) => {
    setList((prev) => prev.filter((t) => t.id !== task.id));
    start(async () => {
      const res = await deleteRelatedTask(kind, parentId, task.id);
      showUndoToast(res, () => router.refresh());
    });
  };

  return (
    <SectionCard
      title={`Tasks · ${list.length}`}
      action={
        <Link href="/tasks" className={buttonGhost}>
          Open global board
        </Link>
      }
    >
      {list.length === 0 ? (
        <EmptyState>
          No tasks yet. Add one below — it also shows on the global board.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-border">
          {list.map((t) => {
            const done = t.completedAt != null;
            return (
              <li key={t.id} className="group flex items-center gap-3 px-5 py-3">
                {canWrite && (
                  <input
                    type="checkbox"
                    checked={done}
                    onChange={(e) => toggleDone(t, e.target.checked)}
                    className="size-4 shrink-0 rounded border-border accent-[var(--color-accent)]"
                    aria-label={`Mark ${t.title} ${done ? "not done" : "done"}`}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/tasks/${t.id}/edit`}
                    className={
                      done
                        ? "truncate text-sm text-muted line-through hover:text-foreground"
                        : "truncate text-sm font-medium hover:text-accent-text"
                    }
                  >
                    {t.title}
                  </Link>
                  <div className="truncate text-xs text-muted">
                    {[t.status, t.assigneeName, t.dueDate ? `due ${formatDate(t.dueDate)}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                {t.priority && <Badge variant={priorityVariant(t.priority)}>{t.priority}</Badge>}
                {canWrite && (
                  <button
                    type="button"
                    aria-label={`Delete ${t.title}`}
                    title="Delete task"
                    onClick={() => remove(t)}
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-md text-muted",
                      "opacity-60 transition hover:bg-elevated hover:text-danger hover:opacity-100",
                      "focus-visible:opacity-100 group-hover:opacity-100",
                    )}
                  >
                    <Icons.close className="size-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canWrite && (
        <form
          ref={formRef}
          action={async (fd) => {
            await quickAddRelatedTask(kind, parentId, fd);
            formRef.current?.reset();
          }}
          className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-3"
        >
          <TextInput
            name="title"
            placeholder={`Add a task for this ${NOUN[kind]}…`}
            className="min-w-48 flex-1"
          />
          {committees && committees.length > 0 && (
            <SelectField
              name="committee"
              defaultValue={defaultCommittee ?? ""}
              aria-label="Committee"
              className="h-9 w-auto min-w-36 py-1 text-sm"
            >
              <option value="">No committee</option>
              {committees.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SelectField>
          )}
          <button className={buttonGhost} type="submit">
            Add
          </button>
        </form>
      )}
    </SectionCard>
  );
}
