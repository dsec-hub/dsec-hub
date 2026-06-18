"use client";

import Link from "next/link";
import { useRef } from "react";

import { SelectField, TextInput } from "@/components/form";
import { Badge, EmptyState, SectionCard, buttonGhost } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { priorityVariant } from "@/lib/workspace-options";
import type { RelatedTaskRow, TaskParentKind } from "@/lib/workspace-queries";

import { quickAddRelatedTask } from "@/app/(app)/tasks/actions";

const NOUN: Record<TaskParentKind, string> = {
  sponsor: "sponsor",
  event: "event",
  project: "project",
};

/**
 * The per-entity task board shown on a sponsor / event / project detail page:
 * the tasks linked to that record, plus a quick-add that tags a new task to it
 * (and surfaces it on the global board too). One component for all three
 * relations — see getRelatedTasks / quickAddRelatedTask.
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
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <SectionCard
      title={`Tasks · ${tasks.length}`}
      action={
        <Link href="/tasks" className={buttonGhost}>
          Open global board
        </Link>
      }
    >
      {tasks.length === 0 ? (
        <EmptyState>
          No tasks yet. Add one below — it also shows on the global board.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-border">
          {tasks.map((t) => {
            const done = t.completedAt != null;
            return (
              <li key={t.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
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
