"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Segmented } from "@/components/segmented";
import { Badge, EmptyState, SectionCard, buttonGhost } from "@/components/ui";
import { cn, formatDate, formatTime } from "@/lib/format";
import { dusaVariant, eventStatusVariant } from "@/lib/options";
import type { EventWithLead } from "@/lib/queries";

type View = "list" | "calendar";
type CalMode = "day" | "week" | "month";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Parse 'YYYY-MM-DD' as a *local* date — `new Date(str)` would treat it as UTC
// and shift the day in negative-offset timezones.
function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function ymd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  const wd = (r.getDay() + 6) % 7; // Monday = 0
  r.setDate(r.getDate() - wd);
  r.setHours(0, 0, 0, 0);
  return r;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(1);
  r.setMonth(r.getMonth() + n);
  return r;
}

export function EventsView({
  events,
  today,
}: {
  events: EventWithLead[];
  today: string;
}) {
  const [view, setView] = useState<View>("list");
  const [mode, setMode] = useState<CalMode>("month");
  const [cursor, setCursor] = useState<Date>(() => parseDate(today) ?? new Date());

  // Map each day (YYYY-MM-DD) to the events occurring on it; multi-day events
  // (startDate..endDate) appear on every day they span.
  const byDay = useMemo(() => {
    const map = new Map<string, EventWithLead[]>();
    for (const e of events) {
      const start = parseDate(e.startDate);
      if (!start) continue;
      const end = parseDate(e.endDate) ?? start;
      for (let cur = new Date(start), i = 0; cur <= end && i < 366; cur = addDays(cur, 1), i++) {
        const k = ymd(cur);
        const list = map.get(k);
        if (list) list.push(e);
        else map.set(k, [e]);
      }
    }
    return map;
  }, [events]);

  const unscheduled = useMemo(
    () => events.filter((e) => !parseDate(e.startDate)),
    [events],
  );

  function step(dir: -1 | 1) {
    setCursor((c) =>
      mode === "month" ? addMonths(c, dir) : addDays(c, dir * (mode === "week" ? 7 : 1)),
    );
  }

  const periodLabel = useMemo(() => {
    if (mode === "month") {
      return cursor.toLocaleDateString("en-AU", { month: "long", year: "numeric" });
    }
    if (mode === "day") {
      return cursor.toLocaleDateString("en-AU", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }
    const ws = startOfWeek(cursor);
    const we = addDays(ws, 6);
    const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
    return `${ws.toLocaleDateString("en-AU", opts)} – ${we.toLocaleDateString("en-AU", { ...opts, year: "numeric" })}`;
  }, [cursor, mode]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          options={[
            { value: "list", label: "List" },
            { value: "calendar", label: "Calendar" },
          ]}
          value={view}
          onChange={(v) => setView(v as View)}
        />

        {view === "calendar" && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => step(-1)} className={cn(buttonGhost, "px-2")} aria-label="Previous">
                ‹
              </button>
              <button
                type="button"
                onClick={() => setCursor(parseDate(today) ?? new Date())}
                className={cn(buttonGhost, "px-2")}
              >
                Today
              </button>
              <button type="button" onClick={() => step(1)} className={cn(buttonGhost, "px-2")} aria-label="Next">
                ›
              </button>
            </div>
            <span className="min-w-40 text-sm font-medium">{periodLabel}</span>
            <Segmented
              options={[
                { value: "day", label: "Day" },
                { value: "week", label: "Week" },
                { value: "month", label: "Month" },
              ]}
              value={mode}
              onChange={(v) => setMode(v as CalMode)}
            />
          </div>
        )}
      </div>

      {view === "list" ? (
        <ListView events={events} />
      ) : mode === "month" ? (
        <MonthView cursor={cursor} today={today} byDay={byDay} />
      ) : mode === "week" ? (
        <WeekView cursor={cursor} today={today} byDay={byDay} />
      ) : (
        <DayView cursor={cursor} today={today} byDay={byDay} />
      )}

      {view === "calendar" && unscheduled.length > 0 && (
        <SectionCard title={`${unscheduled.length} without a date`}>
          <ul className="divide-y divide-border">
            {unscheduled.map((e) => (
              <li key={e.id}>
                <EventRow e={e} className="px-5 py-2.5" />
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}

function ListView({ events }: { events: EventWithLead[] }) {
  return (
    <SectionCard title={`${events.length} event${events.length === 1 ? "" : "s"}`}>
      {events.length === 0 ? (
        <EmptyState>No events yet — create the first one.</EmptyState>
      ) : (
        <ul className="divide-y divide-border">
          {events.map((e) => (
            <li key={e.id}>
              <EventRow e={e} className="px-5 py-3" />
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function EventRow({ e, className }: { e: EventWithLead; className?: string }) {
  return (
    <Link
      href={`/events/${e.id}`}
      className={cn(
        "flex items-center justify-between gap-4 transition-colors hover:bg-elevated/50",
        className,
      )}
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{e.name}</div>
        <div className="mt-0.5 truncate text-xs text-muted">
          {formatDate(e.startDate)}
          {e.startTime ? ` · ${formatTime(e.startTime)}` : ""} ·{" "}
          {e.leadName ?? "no lead"} · {e.committee ?? "—"}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {!e.isPublic && <Badge variant="warning">Draft</Badge>}
        {e.status !== "Completed" && (
          <Badge variant={dusaVariant(e.dusaSubmissionStatus)}>{e.dusaSubmissionStatus ?? "—"}</Badge>
        )}
        <Badge variant={eventStatusVariant(e.status)}>{e.status ?? "—"}</Badge>
      </div>
    </Link>
  );
}

/** Compact pill for an event inside a calendar cell. */
function EventPill({ e }: { e: EventWithLead }) {
  return (
    <Link
      href={`/events/${e.id}`}
      title={e.name}
      className="block truncate rounded-md border-l-2 border-accent bg-elevated px-1.5 py-0.5 text-xs hover:bg-accent/10"
    >
      {e.name}
    </Link>
  );
}

function MonthView({
  cursor,
  today,
  byDay,
}: {
  cursor: Date;
  today: string;
  byDay: Map<string, EventWithLead[]>;
}) {
  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = startOfWeek(monthStart);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="grid grid-cols-7 border-b border-border bg-surface text-xs font-medium text-muted">
        {WEEKDAYS.map((w) => (
          <div key={w} className="px-2 py-2 text-center">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          const key = ymd(d);
          const inMonth = d.getMonth() === cursor.getMonth();
          const isToday = key === today;
          const items = byDay.get(key) ?? [];
          return (
            <div
              key={key}
              className={cn(
                "min-h-24 border-b border-r border-border p-1.5",
                i % 7 === 6 && "border-r-0",
                !inMonth && "bg-surface/40 text-muted",
              )}
            >
              <div
                className={cn(
                  "mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs tabular-nums",
                  isToday && "bg-accent font-semibold text-accent-foreground",
                )}
              >
                {d.getDate()}
              </div>
              <div className="flex flex-col gap-1">
                {items.slice(0, 3).map((e) => (
                  <EventPill key={`${key}-${e.id}`} e={e} />
                ))}
                {items.length > 3 && (
                  <span className="px-1 text-xs text-muted">+{items.length - 3} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({
  cursor,
  today,
  byDay,
}: {
  cursor: Date;
  today: string;
  byDay: Map<string, EventWithLead[]>;
}) {
  const ws = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));

  return (
    <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-7">
      {days.map((d) => {
        const key = ymd(d);
        const items = byDay.get(key) ?? [];
        const isToday = key === today;
        return (
          <div key={key} className="min-h-40 bg-surface p-2">
            <div className={cn("mb-2 text-xs", isToday ? "font-semibold text-accent-text" : "text-muted")}>
              {d.toLocaleDateString("en-AU", { weekday: "short" })} {d.getDate()}
            </div>
            <div className="flex flex-col gap-1">
              {items.length === 0 ? (
                <span className="text-xs text-muted/50">—</span>
              ) : (
                items.map((e) => <EventPill key={`${key}-${e.id}`} e={e} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DayView({
  cursor,
  today,
  byDay,
}: {
  cursor: Date;
  today: string;
  byDay: Map<string, EventWithLead[]>;
}) {
  const key = ymd(cursor);
  const items = byDay.get(key) ?? [];
  const isToday = key === today;

  return (
    <SectionCard
      title={`${cursor.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}${isToday ? " · Today" : ""}`}
    >
      {items.length === 0 ? (
        <EmptyState>Nothing scheduled for this day.</EmptyState>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((e) => (
            <li key={e.id}>
              <EventRow e={e} className="px-5 py-3" />
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
