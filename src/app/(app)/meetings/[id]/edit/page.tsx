import { notFound } from "next/navigation";

import { ConfirmButton } from "@/components/confirm-button";
import { PageHeader, buttonGhost } from "@/components/ui";
import { requireModule } from "@/lib/dal";
import { cn } from "@/lib/format";
import { canWrite } from "@/lib/rbac";
import { getEventOptions, getMeetingById, getPersonOptions } from "@/lib/workspace-queries";

import { archiveMeeting, deleteMeeting, updateMeeting } from "../../actions";
import { MeetingForm } from "../../meeting-form";
import { GenerateNotesButton } from "../../notes-button";

export default async function EditMeetingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireModule("meetings");
  const writable = canWrite(me.modules, me.writeModules, "meetings");
  const { id } = await params;
  const meetingId = Number(id);
  if (Number.isNaN(meetingId)) notFound();

  const [meeting, events, people] = await Promise.all([
    getMeetingById(meetingId),
    getEventOptions(),
    getPersonOptions(),
  ]);
  if (!meeting) notFound();

  return (
    <>
      <PageHeader
        title="Edit meeting"
        description={meeting.title}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Meetings", href: "/meetings" },
          { label: meeting.title },
        ]}
        action={
          writable ? (
            <div className="flex items-center gap-2">
              {meeting.transcript && <GenerateNotesButton meetingId={meetingId} />}
              <form
                action={async () => {
                  "use server";
                  await archiveMeeting(meetingId);
                }}
              >
                <button className={buttonGhost}>Archive</button>
              </form>
              <ConfirmButton
                action={deleteMeeting.bind(null, meetingId)}
                confirm="Delete this meeting permanently? This cannot be undone."
                className={cn(buttonGhost, "text-danger hover:text-danger")}
              >
                Delete
              </ConfirmButton>
            </div>
          ) : undefined
        }
      />
      {meeting.summary && (
        <div className="mb-6 rounded-xl border border-border bg-surface p-5">
          <div className="text-xs uppercase tracking-wide text-muted">AI summary</div>
          <p className="mt-1.5 text-sm">{meeting.summary}</p>
        </div>
      )}
      <MeetingForm
        action={updateMeeting.bind(null, meetingId)}
        meeting={meeting}
        events={events}
        people={people}
        canWrite={writable}
      />
    </>
  );
}
