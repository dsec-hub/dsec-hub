"use client";

import Link from "next/link";

import { Icons } from "@/components/icons";
import { Badge, EmptyState } from "@/components/ui";
import { cn, formatDate, formatTime } from "@/lib/format";
import { dusaVariant, eventStatusVariant } from "@/lib/options";
import type { EventGroup } from "@/lib/event-view-helpers";
import type { EventWithLead } from "@/lib/queries";

/** One event line, shared by the grouped list and the calendar's day view. In
 * the "Related" (cluster) view, `relatedLabels` annotates how it connects. */
export function EventRow({
  e,
  className,
  relatedLabels,
}: {
  e: EventWithLead;
  className?: string;
  relatedLabels?: string[];
}) {
  return (
    <Link
      href={`/events/${e.id}`}
      className={cn(
        "flex items-center justify-between gap-4 transition-colors hover:bg-elevated/50",
        className,
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{e.name}</span>
          {relatedLabels && relatedLabels.length > 0 && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent/10 px-1.5 py-0.5 text-[11px] text-accent-text">
              <Icons.link className="size-3" />
              {relatedLabels.join(" · ")}
            </span>
          )}
        </div>
        <div className="mt-0.5 truncate text-xs text-muted">
          {formatDate(e.startDate)}
          {e.startTime ? ` · ${formatTime(e.startTime)}` : ""} · {e.leadName ?? "no lead"} ·{" "}
          {e.committee ?? "—"}
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

/** Sectioned list — one card per group, or a single flat card when ungrouped.
 * `labelsByEvent` (cluster view only) annotates each row with its link labels. */
export function GroupedEventList({
  groups,
  ungrouped,
  labelsByEvent,
}: {
  groups: EventGroup[];
  ungrouped: boolean;
  labelsByEvent?: Map<number, string[]> | null;
}) {
  const total = groups.reduce((n, g) => n + g.events.length, 0);
  if (total === 0) {
    return <EmptyState>No events match this view. Adjust the filters, or create one.</EmptyState>;
  }
  return (
    <div className="flex flex-col gap-5">
      {groups.map((g) => {
        const isCluster = g.key.startsWith("cluster:");
        return (
          <section
            key={g.key}
            className={cn(
              "overflow-hidden rounded-xl border bg-surface",
              isCluster ? "border-accent/30 ring-1 ring-accent/10" : "border-border",
            )}
          >
            {!ungrouped && (
              <header className="flex items-center gap-2 border-b border-border px-5 py-2.5">
                {isCluster && <Icons.link className="size-3.5 text-accent-text" />}
                <h3 className="text-sm font-medium">{g.label || "Events"}</h3>
                <span className="rounded-full bg-elevated px-1.5 text-xs tabular-nums text-muted">
                  {g.events.length}
                </span>
              </header>
            )}
            <ul className="divide-y divide-border">
              {g.events.map((e) => (
                <li key={e.id}>
                  <EventRow e={e} className="px-5 py-3" relatedLabels={labelsByEvent?.get(e.id)} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
