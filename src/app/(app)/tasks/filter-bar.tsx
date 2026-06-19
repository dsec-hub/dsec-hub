"use client";

import { useState } from "react";
import Link from "next/link";

import { SelectField } from "@/components/form";
import { Icons } from "@/components/icons";
import { Segmented } from "@/components/segmented";
import { cn } from "@/lib/format";
import { DUE_OPTIONS, GROUP_BY_OPTIONS, SORT_OPTIONS } from "@/lib/task-view-helpers";
import type { Option } from "@/lib/workspace-queries";
import { TASK_PRIORITIES } from "@/lib/workspace-options";
import type { TaskFilter, TaskGroupBy, TaskSortKey, TaskViewMode, ViewConfigTV } from "@/lib/task-view-types";

export type ToolbarOptions = {
  committees: string[];
  people: Option[];
  events: Option[];
  statuses: string[];
  boards: Option[];
};

/** Small labelled inline select used across the toolbar. */
function Pick({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-muted">
      <span className="shrink-0">{label}</span>
      <SelectField
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-auto min-w-28 py-1 text-xs"
        aria-label={label}
      >
        {children}
      </SelectField>
    </label>
  );
}

const numOrNull = (v: string): number | null => (v === "" ? null : Number(v) || null);

export function TasksToolbar({
  config,
  onFilter,
  onGroupBy,
  onSort,
  onMode,
  onClear,
  options,
  fullWrite = false,
}: {
  config: ViewConfigTV;
  onFilter: (patch: Partial<TaskFilter>) => void;
  onGroupBy: (g: TaskGroupBy) => void;
  onSort: (s: { key: TaskSortKey; dir: "asc" | "desc" }) => void;
  onMode: (m: TaskViewMode) => void;
  onClear: () => void;
  options: ToolbarOptions;
  fullWrite?: boolean;
}) {
  const f = config.filter;
  const assigneeVal = f.assignee == null ? "" : String(f.assignee);
  const boardVal = f.boardId == null ? "" : f.boardId === "inbox" ? "inbox" : String(f.boardId);
  // A specific board is selected (not "All boards" or the Inbox) → offer to edit it.
  const selectedBoardId = typeof f.boardId === "number" ? f.boardId : null;

  // The 7 narrowing filters are collapsed by default to keep the board calm.
  // Board grouping/sort/mode + the board switcher stay visible (primary lenses).
  const [open, setOpen] = useState(false);
  const activeCount = [
    f.search && f.search.trim(),
    f.assignee != null,
    f.committee,
    f.relatedEventId != null,
    f.relatedProjectId != null,
    f.status,
    f.priority,
    f.due,
  ].filter(Boolean).length;

  function setBoard(v: string) {
    onFilter({ boardId: v === "" ? null : v === "inbox" ? "inbox" : numOrNull(v) });
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Primary controls — always visible */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-1.5">
            <Pick label="Board" value={boardVal} onChange={setBoard}>
              <option value="">All boards</option>
              <option value="inbox">Inbox</option>
              {options.boards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Pick>
            {fullWrite && selectedBoardId != null && (
              <Link
                href={`/tasks/boards/${selectedBoardId}/edit`}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted transition-colors hover:bg-elevated hover:text-foreground"
                aria-label="Edit board"
                title="Edit board"
              >
                <Icons.settings className="size-4" />
              </Link>
            )}
          </div>
          <Pick label="Group by" value={config.groupBy} onChange={(v) => onGroupBy(v as TaskGroupBy)}>
            {GROUP_BY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Pick>
          <div className="flex items-center gap-1.5">
            <Pick label="Sort" value={config.sort.key} onChange={(v) => onSort({ key: v as TaskSortKey, dir: config.sort.dir })}>
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Pick>
            <button
              type="button"
              onClick={() => onSort({ key: config.sort.key, dir: config.sort.dir === "asc" ? "desc" : "asc" })}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-xs text-muted transition-colors hover:bg-elevated hover:text-foreground"
              aria-label={config.sort.dir === "asc" ? "Ascending" : "Descending"}
              title={config.sort.dir === "asc" ? "Ascending" : "Descending"}
            >
              {config.sort.dir === "asc" ? "↑" : "↓"}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium transition-colors",
              open || activeCount > 0
                ? "bg-elevated text-foreground"
                : "text-muted hover:bg-elevated hover:text-foreground",
            )}
          >
            Filters
            {activeCount > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground tabular-nums">
                {activeCount}
              </span>
            )}
            <Icons.chevron className={cn("size-3.5 transition-transform", open && "rotate-180")} />
          </button>
          <Segmented
            value={config.mode}
            onChange={(v) => onMode(v as TaskViewMode)}
            options={[
              { value: "board", label: "Board" },
              { value: "list", label: "List" },
            ]}
          />
        </div>
      </div>

      {/* Filters — collapsed by default */}
      {open && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-surface/60 p-3">
          <input
            type="search"
            value={f.search ?? ""}
            onChange={(e) => onFilter({ search: e.target.value || null })}
            placeholder="Search tasks…"
            className="h-8 w-44 rounded-md border border-border bg-surface px-3 text-xs outline-none transition-colors focus:border-accent"
            aria-label="Search tasks"
          />
          <Pick label="Assignee" value={assigneeVal} onChange={(v) => onFilter({ assignee: v === "me" ? "me" : numOrNull(v) })}>
            <option value="">Anyone</option>
            <option value="me">Me</option>
            {options.people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Pick>
          <Pick label="Committee" value={f.committee ?? ""} onChange={(v) => onFilter({ committee: v || null })}>
            <option value="">Any</option>
            {options.committees.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Pick>
          <Pick
            label="Event"
            value={f.relatedEventId == null ? "" : String(f.relatedEventId)}
            onChange={(v) => onFilter({ relatedEventId: numOrNull(v) })}
          >
            <option value="">Any</option>
            {options.events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </Pick>
          <Pick label="Status" value={f.status ?? ""} onChange={(v) => onFilter({ status: v || null })}>
            <option value="">Any</option>
            {options.statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Pick>
          <Pick label="Priority" value={f.priority ?? ""} onChange={(v) => onFilter({ priority: v || null })}>
            <option value="">Any</option>
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Pick>
          <Pick label="Due" value={f.due ?? ""} onChange={(v) => onFilter({ due: (v || null) as TaskFilter["due"] })}>
            <option value="">Any</option>
            {DUE_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </Pick>
          {activeCount > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="text-xs text-accent-text underline-offset-2 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
