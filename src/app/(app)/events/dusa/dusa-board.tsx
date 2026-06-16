"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Badge } from "@/components/ui";
import { cn, formatDate } from "@/lib/format";
import { dusaVariant } from "@/lib/options";
import type { EventWithLead } from "@/lib/queries";

import { updateDusaStatus } from "../actions";

type Column = { status: string; items: EventWithLead[] };

export function DusaBoard({
  columns: initial,
  canWrite,
}: {
  columns: Column[];
  canWrite: boolean;
}) {
  const [columns, setColumns] = useState<Column[]>(initial);
  const [dragId, setDragId] = useState<number | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [, start] = useTransition();

  function drop(status: string) {
    // View-only: never move cards or persist a status change.
    if (!canWrite) return;
    const id = dragId;
    setOverCol(null);
    setDragId(null);
    if (id == null) return;
    const from = columns.find((c) => c.items.some((e) => e.id === id));
    if (!from || from.status === status) return; // dropped in place — no-op

    let moved: EventWithLead | undefined;
    const next = columns.map((c) => ({
      ...c,
      items: c.items.filter((e) => {
        if (e.id === id) {
          moved = { ...e, dusaSubmissionStatus: status };
          return false;
        }
        return true;
      }),
    }));
    const target = next.find((c) => c.status === status);
    if (moved && target) target.items.push(moved);
    setColumns(next);
    start(async () => {
      await updateDusaStatus(id, status);
    });
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {columns.map((col) => (
        <div
          key={col.status}
          onDragOver={(e) => {
            e.preventDefault();
            setOverCol(col.status);
          }}
          onDragLeave={() => setOverCol((c) => (c === col.status ? null : c))}
          onDrop={() => drop(col.status)}
          className={cn(
            "flex flex-col gap-3 rounded-lg p-1.5 transition-colors",
            overCol === col.status && "bg-elevated/60 ring-1 ring-accent/40",
          )}
        >
          <div className="flex items-center justify-between px-1">
            <span className="text-sm font-medium">{col.status}</span>
            <Badge variant={dusaVariant(col.status)}>{col.items.length}</Badge>
          </div>
          <div className="flex min-h-16 flex-col gap-2">
            {col.items.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted">
                Drop here
              </p>
            ) : (
              col.items.map((e) => (
                <div
                  key={e.id}
                  draggable={canWrite}
                  onDragStart={() => setDragId(e.id)}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverCol(null);
                  }}
                  className={cn(
                    "rounded-xl border border-border bg-surface p-3 transition-opacity hover:bg-elevated",
                    canWrite && "cursor-grab active:cursor-grabbing",
                    dragId === e.id && "opacity-40",
                  )}
                >
                  <Link
                    href={`/events/${e.id}`}
                    className="block min-w-0"
                    onClick={(ev) => ev.stopPropagation()}
                  >
                    <div className="truncate text-sm font-medium">{e.name}</div>
                    <div className="mt-1 text-xs text-muted">
                      {e.dusaDeadline ? `Due ${formatDate(e.dusaDeadline)}` : "No deadline"}
                    </div>
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>
      ))}
      <p className="sr-only">Drag cards between columns to change their DUSA status.</p>
    </div>
  );
}
