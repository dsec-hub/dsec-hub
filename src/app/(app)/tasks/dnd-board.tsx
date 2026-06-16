"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";

import { cn } from "@/lib/format";
import type { TaskCard } from "@/lib/workspace-queries";

import { moveTaskTo, quickAddTask } from "./actions";

const PRIORITY_DOT: Record<string, string> = {
  Urgent: "bg-danger",
  High: "bg-warning",
  Medium: "bg-accent",
  Low: "bg-muted/50",
};

type Column = { name: string; tasks: TaskCard[] };

export function DndBoard({
  columns: initial,
  boardId,
  canWrite,
}: {
  columns: Column[];
  boardId: number | null;
  canWrite: boolean;
}) {
  const [columns, setColumns] = useState<Column[]>(initial);
  const [dragId, setDragId] = useState<number | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [, start] = useTransition();

  // Re-sync from the server whenever the underlying tasks change (a quick-add,
  // a move, an edit elsewhere). Adjusting state during render on a changed
  // signature is React's recommended alternative to an effect; the signature
  // keeps optimistic drags from being clobbered, since the prop array is rebuilt
  // on every render even when the data is identical.
  const sig = useMemo(
    () => initial.map((c) => `${c.name}:${c.tasks.map((t) => t.id).join(",")}`).join("|"),
    [initial],
  );
  const [prevSig, setPrevSig] = useState(sig);
  if (sig !== prevSig) {
    setPrevSig(sig);
    setColumns(initial);
  }

  function drop(colName: string) {
    if (!canWrite) return; // view-only: no optimistic move, no server call
    const id = dragId;
    setOverCol(null);
    setDragId(null);
    if (id == null) return;
    const from = columns.find((c) => c.tasks.some((t) => t.id === id));
    if (!from || from.name === colName) return; // dropped in place — no-op

    let moved: TaskCard | undefined;
    const next = columns.map((c) => ({
      ...c,
      tasks: c.tasks.filter((t) => {
        if (t.id === id) {
          moved = { ...t, status: colName };
          return false;
        }
        return true;
      }),
    }));
    const target = next.find((c) => c.name === colName);
    if (moved && target) target.tasks.push(moved);
    setColumns(next);
    start(async () => {
      await moveTaskTo(id, colName);
    });
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {columns.map((col) => (
        <div
          key={col.name}
          onDragOver={(e) => {
            e.preventDefault();
            setOverCol(col.name);
          }}
          onDragLeave={() => setOverCol((c) => (c === col.name ? null : c))}
          onDrop={() => drop(col.name)}
          className={cn(
            "w-72 shrink-0 rounded-lg p-1.5 transition-colors",
            overCol === col.name && "bg-elevated/60 ring-1 ring-accent/40",
          )}
        >
          <div className="mb-2 flex items-center justify-between px-2">
            <span className="text-sm font-medium">{col.name}</span>
            <span className="rounded-full bg-elevated px-1.5 text-xs tabular-nums text-muted">
              {col.tasks.length}
            </span>
          </div>
          <div className="flex min-h-16 flex-col gap-2">
            {col.tasks.map((t) => (
              <div
                key={t.id}
                draggable={canWrite}
                onDragStart={() => setDragId(t.id)}
                onDragEnd={() => {
                  setDragId(null);
                  setOverCol(null);
                }}
                className={cn(
                  "rounded-xl border border-border bg-surface p-3 transition-opacity",
                  canWrite && "cursor-grab active:cursor-grabbing",
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
                    onClick={(e) => e.stopPropagation()}
                  >
                    {t.title}
                  </Link>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted">
                  {t.assigneeName && <span className="truncate">{t.assigneeName}</span>}
                  {t.dueDate && <span className="tabular-nums">· {t.dueDate}</span>}
                </div>
              </div>
            ))}
            {canWrite && <QuickAdd boardId={boardId} status={col.name} />}
          </div>
        </div>
      ))}
      {canWrite && (
        <p className="sr-only">Drag cards between columns to change their status.</p>
      )}
    </div>
  );
}

/** Inline "add a card" affordance at the bottom of a column. */
function QuickAdd({ boardId, status }: { boardId: number | null; status: string }) {
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
