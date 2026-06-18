import Link from "next/link";
import { notFound } from "next/navigation";

import { Markdown } from "@/components/markdown";
import { Badge, PageHeader, SectionCard, buttonSecondary } from "@/components/ui";

import { MeetingActionItems } from "./action-items";
import { requireModule } from "@/lib/dal";
import { committeeScopeOf } from "@/lib/scope";
import { formatDate } from "@/lib/format";
import { canWrite } from "@/lib/rbac";
import { attendeeName, meetingStatusVariant } from "@/lib/workspace-options";
import { getMeetingById } from "@/lib/workspace-queries";

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireModule("meetings");
  const writable = canWrite(me.modules, me.writeModules, "meetings");
  const { id } = await params;
  const mid = Number(id);
  if (Number.isNaN(mid)) notFound();
  const meeting = await getMeetingById(mid, committeeScopeOf(me));
  if (!meeting) notFound(); // out-of-committee meetings read as not-found
  const actions = meeting.actionItems ?? [];

  return (
    <>
      <PageHeader
        title={meeting.title}
        description={[meeting.type, formatDate(meeting.meetingDate), meeting.location].filter(Boolean).join(" · ")}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Meetings", href: "/meetings" },
          { label: meeting.title },
        ]}
        action={
          writable ? (
            <Link href={`/meetings/${meeting.id}/edit`} className={buttonSecondary}>
              Edit
            </Link>
          ) : undefined
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge variant={meetingStatusVariant(meeting.status)}>{meeting.status ?? "—"}</Badge>
        {meeting.attendees && meeting.attendees.length > 0 && (
          <span className="text-xs text-muted">{meeting.attendees.length} attendees</span>
        )}
      </div>

      {meeting.summary && (
        <SectionCard title="Summary" className="mb-6">
          <div className="p-5 text-sm leading-relaxed text-foreground/90">{meeting.summary}</div>
        </SectionCard>
      )}

      {actions.length > 0 && (
        <MeetingActionItems meetingId={meeting.id} items={actions} canWrite={writable} />
      )}

      {meeting.notes && (
        <SectionCard title="Minutes" className="mb-6">
          <div className="p-5">
            <Markdown content={meeting.notes} />
          </div>
        </SectionCard>
      )}

      {meeting.attendees && meeting.attendees.length > 0 && (
        <SectionCard title="Attendees" className="mb-6">
          <div className="flex flex-wrap gap-1.5 p-5">
            {meeting.attendees.map((a, i) => (
              <Badge key={i} variant="neutral">{attendeeName(a)}</Badge>
            ))}
          </div>
        </SectionCard>
      )}

      {meeting.transcript && (
        <details className="rounded-xl border border-border bg-surface">
          <summary className="cursor-pointer px-5 py-3 text-sm font-medium">Transcript</summary>
          <pre className="overflow-x-auto whitespace-pre-wrap px-5 pb-5 text-xs text-muted">{meeting.transcript}</pre>
        </details>
      )}
    </>
  );
}
