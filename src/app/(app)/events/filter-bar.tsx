"use client";

import { useState } from "react";

import { SelectField } from "@/components/form";
import { Icons } from "@/components/icons";
import { Segmented } from "@/components/segmented";
import { cn } from "@/lib/format";
import {
  EVENT_DATE_OPTIONS,
  EVENT_GROUP_BY_OPTIONS,
  EVENT_SORT_OPTIONS,
} from "@/lib/event-view-helpers";
import type {
  EventFilter,
  EventGroupBy,
  EventSortKey,
  EventViewMode,
  ViewConfigEV,
} from "@/lib/event-view-types";
import { DUSA_STATUSES, EVENT_FORMATS, EVENT_STATUSES, EVENT_TYPES } from "@/lib/options";
import type { Option } from "@/lib/workspace-queries";

export type EventToolbarOptions = {
  committees: string[];
  leads: Option[];
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

export function EventsToolbar({
  config,
  onFilter,
  onGroupBy,
  onSort,
  onMode,
  onClear,
  options,
}: {
  config: ViewConfigEV;
  onFilter: (patch: Partial<EventFilter>) => void;
  onGroupBy: (g: EventGroupBy) => void;
  onSort: (s: { key: EventSortKey; dir: "asc" | "desc" }) => void;
  onMode: (m: EventViewMode) => void;
  onClear: () => void;
  options: EventToolbarOptions;
}) {
  const f = config.filter;
  const isCalendar = config.mode === "calendar";

  // Filters collapse by default to keep the page calm; group/sort/mode stay out.
  const [open, setOpen] = useState(false);
  const activeCount = [
    f.search && f.search.trim(),
    f.status,
    f.type,
    f.committee,
    f.leadId != null,
    f.format,
    f.dusa,
    f.date,
    f.published,
  ].filter(Boolean).length;

  return (
    <div className="flex flex-col gap-3">
      {/* Primary controls — always visible */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {!isCalendar && (
            <>
              <Pick label="Group by" value={config.groupBy} onChange={(v) => onGroupBy(v as EventGroupBy)}>
                {EVENT_GROUP_BY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Pick>
              <div className="flex items-center gap-1.5">
                <Pick
                  label="Sort"
                  value={config.sort.key}
                  onChange={(v) => onSort({ key: v as EventSortKey, dir: config.sort.dir })}
                >
                  {EVENT_SORT_OPTIONS.map((o) => (
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
            </>
          )}
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
            onChange={(v) => onMode(v as EventViewMode)}
            options={[
              { value: "list", label: "List" },
              { value: "calendar", label: "Calendar" },
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
            placeholder="Search events…"
            className="h-8 w-44 rounded-md border border-border bg-surface px-3 text-xs outline-none transition-colors focus:border-accent"
            aria-label="Search events"
          />
          <Pick label="Status" value={f.status ?? ""} onChange={(v) => onFilter({ status: v || null })}>
            <option value="">Any</option>
            {EVENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Pick>
          <Pick label="Type" value={f.type ?? ""} onChange={(v) => onFilter({ type: v || null })}>
            <option value="">Any</option>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
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
            label="Lead"
            value={f.leadId == null ? "" : String(f.leadId)}
            onChange={(v) => onFilter({ leadId: v === "me" ? "me" : numOrNull(v) })}
          >
            <option value="">Anyone</option>
            <option value="me">Me</option>
            {options.leads.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Pick>
          <Pick label="Format" value={f.format ?? ""} onChange={(v) => onFilter({ format: v || null })}>
            <option value="">Any</option>
            {EVENT_FORMATS.map((fmt) => (
              <option key={fmt} value={fmt}>
                {fmt}
              </option>
            ))}
          </Pick>
          <Pick label="DUSA" value={f.dusa ?? ""} onChange={(v) => onFilter({ dusa: v || null })}>
            <option value="">Any</option>
            {DUSA_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Pick>
          <Pick
            label="When"
            value={f.date ?? ""}
            onChange={(v) => onFilter({ date: (v || null) as EventFilter["date"] })}
          >
            <option value="">Any time</option>
            {EVENT_DATE_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </Pick>
          <Pick
            label="Published"
            value={f.published ?? ""}
            onChange={(v) => onFilter({ published: (v || null) as EventFilter["published"] })}
          >
            <option value="">Any</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
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
