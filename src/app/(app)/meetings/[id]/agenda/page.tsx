import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { ConfirmButton } from "@/components/confirm-button";
import { CopyableLink } from "@/components/copyable-link";
import { Badge, PageHeader, buttonPrimary, buttonSecondary } from "@/components/ui";
import { requireModule } from "@/lib/dal";
import { canWrite } from "@/lib/rbac";
import { committeeScopeOf } from "@/lib/scope";
import { agendaStatusMeta } from "@/lib/agenda";
import {
  getEventOptions,
  getMeetingById,
  getPersonOptions,
  getTaskOptions,
} from "@/lib/workspace-queries";

import { AgendaEditor } from "./agenda-editor";
import { lockAgenda, saveAgenda, shareAgenda } from "./actions";

/**
 * Absolute origin for the public share link. Prefers APP_URL (set in prod);
 * otherwise derives from the request host. Unlike invite links — whose token is
 * emailed and must never be built from a spoofable Host — the agenda token is
 * already a public credential the committee member copies from their own page,
 * so a host-derived origin is safe here and avoids a broken relative link.
 */
async function shareOrigin(): Promise<string> {
  const env = process.env.APP_URL?.replace(/\/$/, "");
  if (env) return env;
  const h = await headers();
  const host = h.get("host") ?? "localhost:3002";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function MeetingAgendaPage({
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

  const [people, events, tasks] = await Promise.all([
    getPersonOptions(),
    getEventOptions(),
    getTaskOptions(),
  ]);

  // Absolute public link (only once shared).
  const shareUrl = meeting.agendaShareToken
    ? `${await shareOrigin()}/agenda/${meeting.agendaShareToken}`
    : null;

  const status = meeting.agendaStatus;
  const statusMeta = agendaStatusMeta(status);
  const editable = writable && status !== "locked";

  return (
    <>
      <PageHeader
        title="Agenda"
        description={meeting.title}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Meetings", href: "/meetings" },
          { label: meeting.title, href: `/meetings/${meeting.id}` },
          { label: "Agenda" },
        ]}
      />

      <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
        {shareUrl ? (
          <span className="text-sm text-muted">
            Public link:{" "}
            <CopyableLink href={shareUrl}>
              {shareUrl.replace(/^https?:\/\//, "")}
            </CopyableLink>
          </span>
        ) : (
          <span className="text-sm text-muted">
            Private draft — only the committee can see this.
          </span>
        )}
      </div>

      {writable && (
        <div className="mb-6 flex flex-wrap gap-2">
          {status === "draft" ? (
            <ConfirmButton
              action={shareAgenda.bind(null, mid)}
              confirm="Share this agenda? It creates a public, read-only link that anyone who has it can open."
              className={buttonPrimary}
            >
              Share with invitees
            </ConfirmButton>
          ) : status === "shared" ? (
            <ConfirmButton
              action={lockAgenda.bind(null, mid)}
              confirm="Lock the agenda? It stays viewable at its link but can no longer be edited."
              className={buttonSecondary}
            >
              Lock agenda
            </ConfirmButton>
          ) : (
            <span className="text-xs text-muted">
              This agenda is locked — frozen for the meeting. It remains viewable at its link.
            </span>
          )}
        </div>
      )}

      <AgendaEditor
        initialItems={meeting.agendaItems ?? []}
        people={people}
        events={events}
        tasks={tasks}
        canWrite={editable}
        action={saveAgenda.bind(null, mid)}
      />
    </>
  );
}
