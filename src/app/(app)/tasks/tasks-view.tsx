"use client";

import Link from "next/link";
import { useState } from "react";

import { Segmented } from "@/components/segmented";
import { Badge, EmptyState, SectionCard, buttonGhost } from "@/components/ui";
import { priorityVariant } from "@/lib/workspace-options";
import type { TaskCard } from "@/lib/workspace-queries";

import { MoveControl } from "./move-control";
import { DndBoard } from "./dnd-board";

type Column = { name: string; tasks: TaskCard[] };
type View = "board" | "list";

export function TasksView({
  columns,
  boardId,
  canWrite,
}: {
  columns: Column[];
  boardId: number | null;
  canWrite: boolean;
}) {
  const [view, setView] = useState<View>("board");
  const columnNames = columns.map((c) => c.name);
  const allTasks = columns.flatMap((c) => c.tasks);

  return (
    <div className="flex flex-col gap-4">
      <Segmented
        value={view}
        onChange={(v) => setView(v as View)}
        options={[
          { value: "board", label: "Board" },
          { value: "list", label: "List" },
        ]}
      />

      {view === "board" ? (
        <DndBoard columns={columns} boardId={boardId} canWrite={canWrite} />
      ) : (
        <SectionCard title={`${allTasks.length} task${allTasks.length === 1 ? "" : "s"}`}>
          {allTasks.length === 0 ? (
            <EmptyState>No tasks here yet — switch to Board view to add one.</EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {allTasks.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/tasks/${t.id}/edit`}
                      className="text-sm transition-colors hover:text-accent-text"
                    >
                      {t.title}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                      {t.priority && (
                        <Badge variant={priorityVariant(t.priority)}>{t.priority}</Badge>
                      )}
                      {t.assigneeName && <span className="truncate">{t.assigneeName}</span>}
                      {t.dueDate && <span className="tabular-nums">· {t.dueDate}</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <MoveControl
                      taskId={t.id}
                      columns={columnNames}
                      current={t.status}
                      canWrite={canWrite}
                    />
                    {canWrite && (
                      <Link href={`/tasks/${t.id}/edit`} className={buttonGhost}>
                        Edit
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}
    </div>
  );
}
