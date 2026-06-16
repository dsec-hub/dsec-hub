import Link from "next/link";

import { Badge, EmptyState, PageHeader, SectionCard, buttonGhost } from "@/components/ui";
import { requireModule } from "@/lib/dal";
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
  const [meetings, events, people] = await Promise.all([
    getMeetings(50),
    getEventOptions(),
    getPersonOptions(),
  ]);

  return (
    <>
      <PageHeader
        title="Meetings"
        description="Minutes from every committee and exec meeting. Drop a raw transcript into the MCP generate_meeting_notes tool to turn it into a clean summary and action items."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Meetings" }]}
        action={writable ? <NewMeetingButton events={events} people={people} /> : undefined}
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
                    <div className="mt-0.5 text-xs text-muted">
                      {m.type ?? "—"} · {formatDate(m.meetingDate)} · {m.location ?? "—"}
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
