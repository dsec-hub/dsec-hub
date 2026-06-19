import { notFound } from "next/navigation";

import { UndoButton } from "@/components/undo-button";
import { MediaManager } from "@/components/media-manager";
import { PublishToggle } from "@/components/publish-toggle";
import { PageHeader, buttonGhost } from "@/components/ui";
import { getCommitteeOptions } from "@/lib/committee-queries";
import { requireModule } from "@/lib/dal";
import { cn } from "@/lib/format";
import { getEventById, getPeopleOptions, getSponsorOptions } from "@/lib/queries";
import { getEventOwners } from "@/lib/owners";
import { canWrite } from "@/lib/rbac";
import { fetchReviewSummary } from "@/lib/reviews";
import {
  getEventConnections,
  getEventOptions,
  getEventPartners,
  getEventSpeakers,
  getEventSponsors,
  getMedia,
  getPartnerOptions,
} from "@/lib/workspace-queries";

import { archiveEvent, deleteEvent, setEventPublished, updateEvent } from "../../actions";
import { EventForm } from "../../event-form";
import { EventConnections } from "../event-connections";
import { EventPartners } from "../event-partners";
import { EventSpeakers } from "../event-speakers";
import { EventSponsors } from "../event-sponsors";
import { ReviewPanel } from "../../review-panel";

export default async function EditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireModule("events");
  const writable = canWrite(me.modules, me.writeModules, "events");
  const { id } = await params;
  const eventId = Number(id);
  if (Number.isNaN(eventId)) notFound();

  const [
    event,
    people,
    sponsors,
    committees,
    media,
    speakers,
    eventSponsors,
    partnerOptions,
    eventPartners,
    eventOptions,
    eventConnections,
    coOwners,
  ] = await Promise.all([
    getEventById(eventId),
    getPeopleOptions(),
    getSponsorOptions(),
    getCommitteeOptions(),
    getMedia("event", eventId),
    getEventSpeakers(eventId).catch(() => []),
    getEventSponsors(eventId).catch(() => []),
    getPartnerOptions(),
    getEventPartners(eventId).catch(() => []),
    getEventOptions(),
    getEventConnections(eventId).catch(() => []),
    getEventOwners(eventId).catch(() => []),
  ]);
  if (!event) notFound();

  // Best-effort live stats; only hit the API when a form actually exists.
  const reviewSummary = event.reviewFormId ? await fetchReviewSummary(eventId) : null;

  return (
    <>
      <PageHeader
        title="Edit event"
        description={event.name}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Events", href: "/events" },
          { label: event.name },
        ]}
        action={
          writable && (
            <div className="flex items-center gap-2">
              <PublishToggle
                published={event.isPublic}
                action={setEventPublished.bind(null, eventId)}
                blockedReason={event.startDate ? undefined : "Add a start date before publishing"}
              />
              <UndoButton
                action={archiveEvent.bind(null, eventId)}
                redirectTo="/events"
                className={buttonGhost}
              >
                Archive
              </UndoButton>
              <UndoButton
                action={deleteEvent.bind(null, eventId)}
                confirm="Delete this event permanently?"
                redirectTo="/events"
                className={cn(buttonGhost, "text-danger hover:text-danger")}
              >
                Delete
              </UndoButton>
            </div>
          )
        }
      />
      <EventForm
        action={updateEvent.bind(null, eventId)}
        people={people}
        committees={committees}
        event={event}
        coOwnerIds={coOwners.map((o) => o.id)}
        redirectOnSuccess="/events"
        canWrite={writable}
      />
      <div className="mt-6">
        <MediaManager
          entityType="event"
          entityId={eventId}
          existing={media}
          canWrite={writable}
        />
      </div>
      <div className="mt-6">
        <EventSpeakers
          eventId={eventId}
          speakers={speakers}
          people={people}
          canWrite={writable}
        />
      </div>
      <div className="mt-6">
        <EventSponsors
          eventId={eventId}
          linked={eventSponsors}
          sponsorOptions={sponsors}
          canWrite={writable}
        />
      </div>
      <div className="mt-6">
        <EventPartners
          eventId={eventId}
          linked={eventPartners}
          partnerOptions={partnerOptions}
          canWrite={writable}
        />
      </div>
      <div className="mt-6">
        <EventConnections
          eventId={eventId}
          linked={eventConnections}
          eventOptions={eventOptions}
          canWrite={writable}
        />
      </div>
      <div className="mt-6">
        <ReviewPanel
          eventId={eventId}
          formUrl={event.reviewFormUrl}
          summary={reviewSummary}
          canWrite={writable}
        />
      </div>
    </>
  );
}
