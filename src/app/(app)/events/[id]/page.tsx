import Link from "next/link";
import { notFound } from "next/navigation";

import { CommitteeDot } from "@/components/committee-select";
import { Markdown } from "@/components/markdown";
import { MediaManager } from "@/components/media-manager";
import { PublishToggle } from "@/components/publish-toggle";
import { RelatedTasks } from "@/components/related-tasks";
import { Badge, Card, PageHeader, SectionCard, buttonSecondary } from "@/components/ui";
import { getCommitteeOptions } from "@/lib/committee-queries";
import { requireModule } from "@/lib/dal";
import { formatAUD, formatDate, formatTime, initials, todayISO } from "@/lib/format";
import { dusaVariant, eventStatusVariant } from "@/lib/options";
import { getEventById, getPeopleOptions } from "@/lib/queries";
import { getEventOwners } from "@/lib/owners";
import { canAccess, canManageRelatedTasks, canWrite } from "@/lib/rbac";
import { fetchReviewSummary } from "@/lib/reviews";
import { committeeScopeOf } from "@/lib/scope";
import {
  getEventConnections,
  getEventDocuments,
  getEventPartners,
  getEventSpeakers,
  getMedia,
  getRelatedTasks,
} from "@/lib/workspace-queries";

import { setEventPublished } from "../actions";
import { ReviewPanel } from "../review-panel";
import { EventDocuments } from "./event-documents";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireModule("events");
  const writable = canWrite(me.modules, me.writeModules, "events");
  // The Tasks card is governed by tasks-write too: a task editor with only
  // view access to events can still tick/add/delete an event's tasks.
  const canEditTasks = canManageRelatedTasks(me.modules, me.writeModules, "events");
  // Docs are their own committee-scoped module: show the section to anyone who
  // can read Docs; allow add/edit/remove to Docs writers (admins included).
  const canAccessDocs = canAccess(me.modules, "documents");
  const canManageDocs = canWrite(me.modules, me.writeModules, "documents");
  const { id } = await params;
  const eventId = Number(id);
  if (Number.isNaN(eventId)) notFound();

  const [
    event,
    people,
    committees,
    media,
    relatedTasks,
    speakers,
    partners,
    connections,
    coLeads,
    eventDocuments,
  ] = await Promise.all([
    getEventById(eventId),
    getPeopleOptions(),
    getCommitteeOptions(),
    getMedia("event", eventId),
    getRelatedTasks("event", eventId),
    getEventSpeakers(eventId).catch(() => []),
    getEventPartners(eventId).catch(() => []),
    getEventConnections(eventId).catch(() => []),
    getEventOwners(eventId).catch(() => []),
    canAccessDocs ? getEventDocuments(eventId, committeeScopeOf(me)) : Promise.resolve([]),
  ]);
  if (!event) notFound();

  const reviewSummary = event.reviewFormId ? await fetchReviewSummary(eventId) : null;

  const leadName = people.find((p) => p.id === event.eventLeadId)?.name ?? null;
  // Primary lead first, then co-leads (event_owner). Label flips to plural.
  const allLeadNames = [leadName, ...coLeads.map((o) => o.name)].filter(Boolean) as string[];
  const committeeColor = committees.find((c) => c.name === event.committee)?.color;

  const dateLabel = event.startDate
    ? formatDate(event.startDate) +
      (event.endDate && event.endDate !== event.startDate
        ? ` – ${formatDate(event.endDate)}`
        : "")
    : "—";
  const timeLabel = event.startTime
    ? formatTime(event.startTime) + (event.endTime ? ` – ${formatTime(event.endTime)}` : "")
    : "—";
  const attendance =
    event.actualAttendance != null
      ? `${event.actualAttendance} attended`
      : event.expectedAttendance != null
        ? `${event.expectedAttendance} expected`
        : "—";

  const tiers = event.ticketTiers ?? [];
  // Completed events don't track DUSA (mirrors event-form.tsx). An event also
  // auto-completes once its start date is past, unless manually Cancelled.
  const isCompleted =
    event.status === "Completed" ||
    (!!event.startDate && event.startDate < todayISO() && event.status !== "Cancelled");
  const showDusa =
    !isCompleted &&
    (event.dusaRequired || !!event.dusaSubmissionStatus || !!event.dusaDeadline);
  const showTickets = !!event.ticketUrl || tiers.length > 0;

  return (
    <>
      <PageHeader
        title={event.name}
        description={[event.type, event.format].filter(Boolean).join(" · ") || undefined}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Events", href: "/events" },
          { label: event.name },
        ]}
        action={
          writable ? (
            <div className="flex items-center gap-2">
              <PublishToggle
                published={event.isPublic}
                action={setEventPublished.bind(null, eventId)}
                blockedReason={event.startDate ? undefined : "Add a start date before publishing"}
              />
              <Link href={`/events/${eventId}/edit`} className={buttonSecondary}>
                Edit
              </Link>
            </div>
          ) : undefined
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge variant={event.isPublic ? "success" : "warning"}>
          {event.isPublic ? "Published" : "Draft"}
        </Badge>
        <Badge variant={eventStatusVariant(event.status)}>{event.status ?? "—"}</Badge>
        {event.foodProvided && <Badge variant="success">Food provided</Badge>}
        {event.externalGuests && <Badge variant="neutral">External guests</Badge>}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Meta label="Date" value={dateLabel} />
        <Meta label="Time" value={timeLabel} />
        <Meta
          label={allLeadNames.length > 1 ? "Leads" : "Lead"}
          value={allLeadNames.length ? allLeadNames.join(", ") : "—"}
        />
        <Meta
          label="Committee"
          value={
            event.committee ? (
              <span className="flex items-center gap-1.5">
                <CommitteeDot color={committeeColor} />
                {event.committee}
              </span>
            ) : (
              "—"
            )
          }
        />
        <Meta label="Venue" value={event.venue ?? "—"} />
        <Meta label="Format" value={event.format ?? "—"} />
        <Meta label="Trimester" value={event.trimester ?? "—"} />
        <Meta label="Attendance" value={attendance} />
      </div>

      {showTickets && (
        <SectionCard title="Tickets" className="mb-6">
          <div className="space-y-4 p-5">
            {event.ticketUrl && (
              <a
                href={event.ticketUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-block break-all text-sm text-accent-text underline underline-offset-2"
              >
                {event.ticketUrl}
              </a>
            )}
            {tiers.length > 0 && (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {tiers.map((t, i) => (
                  <li
                    key={`${t.label}-${i}`}
                    className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm"
                  >
                    <span>{t.label}</span>
                    <span className="tabular-nums text-muted">
                      {t.price == null ? "—" : t.price === 0 ? "Free" : formatAUD(t.price)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </SectionCard>
      )}

      {showDusa && (
        <SectionCard title="DUSA" className="mb-6">
          <dl className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
            <Pair label="Submission">
              <Badge variant={dusaVariant(event.dusaSubmissionStatus)}>
                {event.dusaSubmissionStatus ?? "—"}
              </Badge>
            </Pair>
            <Pair label="Deadline">{formatDate(event.dusaDeadline)}</Pair>
            <Pair label="Required">{event.dusaRequired ? "Yes" : "No"}</Pair>
            <Pair label="External guests">{event.externalGuests ? "Yes" : "No"}</Pair>
          </dl>
        </SectionCard>
      )}

      {event.description && (
        <SectionCard title="Description" className="mb-6">
          <div className="p-5">
            <Markdown content={event.description} />
          </div>
        </SectionCard>
      )}

      {speakers.length > 0 && (
        <SectionCard title={`Speakers · ${speakers.length}`} className="mb-6">
          <ul className="divide-y divide-border">
            {speakers.map((sp) => {
              const photo = sp.photos[0]?.webpUrl ?? sp.inheritedPhoto;
              return (
                <li key={sp.id} className="flex items-start gap-3 px-5 py-4">
                  {photo ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={photo}
                      alt=""
                      className="size-10 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="grid size-10 shrink-0 place-items-center rounded-full bg-elevated text-xs font-medium text-muted">
                      {initials(sp.displayName)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{sp.displayName}</span>
                      {sp.personId && <Badge variant="neutral">Linked</Badge>}
                    </div>
                    {sp.title && <div className="text-xs text-muted">{sp.title}</div>}
                    {sp.bio && <p className="mt-1 text-xs text-muted/80">{sp.bio}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        </SectionCard>
      )}

      {partners.length > 0 && (
        <SectionCard title={`Partners · ${partners.length}`} className="mb-6">
          <ul className="divide-y divide-border">
            {partners.map((pt) => (
              <li key={pt.id} className="flex items-center gap-3 px-5 py-3">
                <div className="grid size-12 shrink-0 place-items-center rounded-md border border-border bg-elevated">
                  {pt.logo ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={pt.logo.webpUrl}
                      alt={`${pt.name} logo`}
                      className="max-h-10 max-w-10 object-contain"
                    />
                  ) : (
                    <span className="text-[10px] text-muted">No logo</span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/partners/${pt.partnerId}`}
                      className="truncate text-sm font-medium hover:text-accent-text"
                    >
                      {pt.name}
                    </Link>
                    {pt.role && <Badge variant="accent">{pt.role}</Badge>}
                  </div>
                  {pt.website && (
                    <a
                      href={pt.website}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="truncate text-xs text-muted hover:text-foreground"
                    >
                      {pt.website}
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {connections.length > 0 && (
        <SectionCard title={`Related events · ${connections.length}`} className="mb-6">
          <ul className="divide-y divide-border">
            {connections.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/events/${c.otherId}`}
                      className="truncate text-sm font-medium hover:text-accent-text"
                    >
                      {c.name}
                    </Link>
                    {c.label && <Badge variant="accent">{c.label}</Badge>}
                    {!c.isPublic && <Badge variant="warning">Draft</Badge>}
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    {c.startDate ? formatDate(c.startDate) : "No date"}
                  </div>
                </div>
                <Badge variant={eventStatusVariant(c.status)}>{c.status ?? "—"}</Badge>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <div className="mb-6">
        <RelatedTasks
          kind="event"
          parentId={eventId}
          tasks={relatedTasks}
          canWrite={canEditTasks}
          committees={committees.map((c) => c.name)}
          defaultCommittee={event.committee}
        />
      </div>

      {canAccessDocs && (
        <div className="mb-6">
          <EventDocuments
            eventId={eventId}
            documents={eventDocuments}
            tasks={relatedTasks.map((t) => ({ id: t.id, title: t.title }))}
            canWrite={canManageDocs}
          />
        </div>
      )}

      {media.length > 0 && (
        <div className="mb-6">
          <MediaManager entityType="event" entityId={eventId} existing={media} canWrite={false} />
        </div>
      )}

      {event.reviewFormUrl && (
        <ReviewPanel
          eventId={eventId}
          formUrl={event.reviewFormUrl}
          summary={reviewSummary}
          canWrite={false}
        />
      )}
    </>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-1.5 text-sm">{value}</div>
    </Card>
  );
}

function Pair({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1.5 text-sm">{children}</dd>
    </div>
  );
}
