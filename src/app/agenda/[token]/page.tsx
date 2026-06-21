import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Markdown } from "@/components/markdown";
import { Badge } from "@/components/ui";
import { formatDate, formatTime } from "@/lib/format";
import { attendeeName } from "@/lib/workspace-options";
import {
  getMeetingByAgendaToken,
  getPeopleNamesByIds,
} from "@/lib/workspace-queries";
import {
  formatDuration,
  sortedAgenda,
  totalAgendaMinutes,
} from "@/lib/agenda";

// Always reflect the latest shared agenda (edits, lock) — never a stale cache.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const meeting = await getMeetingByAgendaToken(token);
  if (!meeting) return { title: "Agenda not found · DSEC" };
  return {
    title: `${meeting.title} · Agenda · DSEC`,
    description: "Pre-meeting agenda shared by the DSEC committee.",
    robots: { index: false, follow: false }, // unguessable link, keep it out of search
  };
}

export default async function PublicAgendaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const meeting = await getMeetingByAgendaToken(token);
  if (!meeting) notFound();

  const items = sortedAgenda(meeting.agendaItems);
  const total = totalAgendaMinutes(meeting.agendaItems);
  const ownerNames = await getPeopleNamesByIds(
    items.map((i) => i.owner_person_id ?? 0).filter(Boolean),
  );

  const when = meeting.meetingDate
    ? formatDate(meeting.meetingDate) +
      (meeting.meetingTime ? ` at ${formatTime(meeting.meetingTime)}` : "")
    : null;
  const meta = [when, meeting.location].filter(Boolean).join(" · ");

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-2xl px-5 py-12 sm:py-16">
        {/* Brand / context line */}
        <div className="mb-8 flex items-center justify-between gap-3">
          <span className="font-mono text-sm font-semibold tracking-tight">
            DSEC<span className="text-accent-text">.</span>
          </span>
          <span className="text-xs uppercase tracking-wide text-muted">
            Meeting agenda
          </span>
        </div>

        {/* Title + meta */}
        <header className="mb-8">
          <h1 className="font-mono text-2xl font-semibold leading-tight sm:text-3xl">
            {meeting.title}
          </h1>
          {meta && <p className="mt-2 text-sm text-muted">{meta}</p>}
          {meeting.attendees && meeting.attendees.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {meeting.attendees.map((a, i) => (
                <Badge key={i} variant="neutral">
                  {attendeeName(a)}
                </Badge>
              ))}
            </div>
          )}
        </header>

        {/* Agenda items */}
        {items.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface px-5 py-10 text-center text-sm text-muted">
            No agenda items yet.
          </p>
        ) : (
          <ol className="space-y-3">
            {items.map((item, i) => {
              const owner = item.owner_person_id
                ? ownerNames.get(item.owner_person_id)
                : null;
              return (
                <li
                  key={item.id}
                  className="rounded-xl border border-border bg-surface px-5 py-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-elevated text-xs font-medium text-muted tabular-nums">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="text-sm font-medium leading-snug">
                          {item.title}
                        </h2>
                        {item.duration_minutes ? (
                          <span className="shrink-0 whitespace-nowrap text-xs text-muted tabular-nums">
                            {formatDuration(item.duration_minutes)}
                          </span>
                        ) : null}
                      </div>
                      {owner && (
                        <p className="mt-1 text-xs text-muted">{owner}</p>
                      )}
                      {item.notes && (
                        <div className="mt-2 text-sm text-foreground/80">
                          <Markdown content={item.notes} />
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {/* Footer: total + provenance */}
        <div className="mt-8 flex items-center justify-between border-t border-border pt-4 text-xs text-muted">
          <span>
            {items.length} item{items.length === 1 ? "" : "s"}
            {total > 0 ? ` · ${formatDuration(total)} estimated` : ""}
          </span>
          <span>Read-only · shared via DSEC Hub</span>
        </div>
      </div>
    </main>
  );
}
