import Link from "next/link";

import { Badge, EmptyState, PageHeader, SectionCard, buttonGhost } from "@/components/ui";
import { requireModule } from "@/lib/dal";
import { committeeScopeOf } from "@/lib/scope";
import { getCommitteeOptions } from "@/lib/committee-queries";
import { formatDate } from "@/lib/format";
import type { BadgeVariant } from "@/lib/options";
import { canWrite } from "@/lib/rbac";
import { getEventOptions, getMeetings, getPersonOptions } from "@/lib/workspace-queries";

import { NewMeetingButton } from "./new-meeting-button";

function meetingStatusVariant(status: string | null | undefined): BadgeVariant {
  switch (status) {
    case "Completed":
      return "success";
    case "Scheduled":
    case "Confirmed":
      return "accent";
    case "Cancelled":
      return "danger";
    case "Draft":
      return "warning";
    default:
      return "neutral";
  }
}

export default async function MeetingsPage() {
  const me = await requireModule("meetings");
  const writable = canWrite(me.modules, me.writeModules, "meetings");
  const scope = committeeScopeOf(me);
  const [meetings, events, people, committeeOpts] = await Promise.all([
    getMeetings(scope, 50),
    getEventOptions(),
    getPersonOptions(),
    getCommitteeOptions(),
  ]);
  const committees = committeeOpts.map((c) => c.name);

  return (
    <>
      <PageHeader
        title="Meetings"
        description={
          scope.all
            ? "Minutes from every committee + exec meeting. Team meetings are visible to that team; club-wide notes to everyone."
            : "Your committee's meeting notes, plus club-wide all-hands. Notes you create are visible to your committee + execs."
        }
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Meetings" }]}
        action={
          writable ? (
            <NewMeetingButton
              events={events}
              people={people}
              committees={committees}
              canChooseCommittee={scope.all}
              lockedCommittee={me.userCommittee}
            />
          ) : undefined
        }
      />

      <SectionCard title={`${meetings.length} meeting${meetings.length === 1 ? "" : "s"}`}>
        {meetings.length === 0 ? (
          <EmptyState>No meetings yet — run generate_meeting_notes to add the first set of minutes.</EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {meetings.map((m) => (
              <li key={m.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Link href={`/meetings/${m.id}`} className="text-sm font-medium hover:text-accent-text">
                      {m.title}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <Badge variant={m.committee ? "accent" : "neutral"}>
                        {m.committee ?? "Club-wide"}
                      </Badge>
                      <span>
                        {m.type ?? "—"} · {formatDate(m.meetingDate)} · {m.location ?? "—"}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Badge variant={meetingStatusVariant(m.status)}>{m.status ?? "—"}</Badge>
                    <Link href={`/meetings/${m.id}/edit`} className={buttonGhost}>
                      Edit
                    </Link>
                  </div>
                </div>

                {m.summary && <p className="mt-2 text-sm text-muted">{m.summary}</p>}

                {m.actionItems && m.actionItems.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {m.actionItems.map((a, i) => (
                      <li key={i} className="text-xs text-muted">
                        • {a.text}
                        {a.owner ? ` — ${a.owner}` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </>
  );
}
