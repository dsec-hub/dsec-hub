"use client";

import Link from "next/link";
import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

import { EmptyState, SectionCard } from "@/components/ui";
import { cn } from "@/lib/format";

import { createSubtask, toggleSubtask } from "./actions";

type Sub = {
  id: number;
  title: string;
  status: string;
  completedAt: string | null;
  assigneeName: string | null;
};

/** One-level subtask checklist on the task detail page: tick to complete, add
 * inline. Children inherit the parent's board + committee (see createSubtask). */
export function Subtasks({
  parentId,
  subtasks,
  canWrite,
}: {
  parentId: number;
  subtasks: Sub[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const done = subtasks.filter((s) => s.completedAt).length;

  return (
    <SectionCard title={subtasks.length ? `Subtasks · ${done}/${subtasks.length}` : "Subtasks"}>
      {subtasks.length === 0 ? (
        <EmptyState>
          Break this task into steps.{canWrite ? " Add the first below." : ""}
        </EmptyState>
      ) : (
        <ul className="divide-y divide-border">
          {subtasks.map((s) => {
            const isDone = s.completedAt != null;
            return (
              <li key={s.id} className="flex items-center gap-3 px-5 py-2.5">
                <input
                  type="checkbox"
                  checked={isDone}
                  disabled={!canWrite || pending}
                  onChange={(e) =>
                    start(async () => {
                      await toggleSubtask(s.id, e.target.checked);
                      router.refresh();
                    })
                  }
                  className="size-4 shrink-0 rounded border-border accent-[var(--color-accent)]"
                  aria-label={`Mark ${s.title} ${isDone ? "not done" : "done"}`}
                />
                <Link
                  href={`/tasks/${s.id}/edit`}
                  className={cn(
                    "min-w-0 flex-1 truncate text-sm transition-colors hover:text-accent-text",
                    isDone && "text-muted line-through",
                  )}
                >
                  {s.title}
                </Link>
                {s.assigneeName && <span className="shrink-0 text-xs text-muted">{s.assigneeName}</span>}
              </li>
            );
          })}
        </ul>
      )}
      {canWrite && (
        <form
          ref={formRef}
          action={async (fd) => {
            await createSubtask(parentId, fd);
            formRef.current?.reset();
          }}
          className="flex items-center gap-2 border-t border-border px-5 py-3"
        >
          <input
            name="title"
            placeholder="Add a subtask…"
            required
            className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent"
          />
          <button type="submit" className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground">
            Add
          </button>
        </form>
      )}
    </SectionCard>
  );
}
