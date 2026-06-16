"use client";

import Link from "next/link";
import { useState } from "react";

import { Icons } from "@/components/icons";
import { Segmented } from "@/components/segmented";
import { Badge, EmptyState, SectionCard, buttonGhost, buttonSecondary } from "@/components/ui";
import { priorityVariant } from "@/lib/workspace-options";
import type { TaskCard } from "@/lib/workspace-queries";

import { MoveControl } from "./move-control";
import { DndBoard } from "./dnd-board";

type Column = { name: string; tasks: TaskCard[] };
type BoardLite = {
  id: number;
  name: string;
  description: string | null;
  committee: string | null;
};
type View = "board" | "list";

export function TasksView({
  columns,
  board,
  canWrite,
}: {
  columns: Column[];
  board: BoardLite | null;
  canWrite: boolean;
}) {
  const [view, setView] = useState<View>("board");
  const columnNames = columns.map((c) => c.name);
  const allTasks = columns.flatMap((c) => c.tasks);
  const count = allTasks.length;
  const boardId = board?.id ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-sm font-medium text-foreground">
              {board ? board.name : "Inbox"}
            </h2>
            {board?.committee && <Badge>{board.committee}</Badge>}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted">
            <span className="tabular-nums">
              {count} {count === 1 ? "task" : "tasks"}
            </span>
            {board?.description
              ? ` · ${board.description}`
              : board
                ? ""
                : " · Tasks with no board land here"}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {board && canWrite && (
            <Link href={`/tasks/boards/${board.id}/edit`} className={buttonSecondary}>
              <Icons.settings className="size-4" />
              Edit board
            </Link>
          )}
          <Segmented
            value={view}
            onChange={(v) => setView(v as View)}
            options={[
              { value: "board", label: "Board" },
              { value: "list", label: "List" },
            ]}
          />
        </div>
      </div>

      {view === "board" ? (
        <DndBoard columns={columns} boardId={boardId} canWrite={canWrite} />
      ) : (
        <SectionCard title={`${count} task${count === 1 ? "" : "s"}`}>
          {count === 0 ? (
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
