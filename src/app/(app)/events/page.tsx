import Link from "next/link";

import { PageHeader, buttonSecondary } from "@/components/ui";
import { getCommitteeOptions } from "@/lib/committee-queries";
import { requireModule } from "@/lib/dal";
import { getSavedEventViews } from "@/lib/event-view-queries";
import { isBuiltInEventViewKey } from "@/lib/event-view-types";
import { todayISO } from "@/lib/format";
import { getEventById, getEvents, getPeopleOptions, getSponsorOptions } from "@/lib/queries";
import { canWrite } from "@/lib/rbac";
import {
  getAllEventConnections,
  getEventConnections,
  getEventOptions,
  getEventPartners,
  getEventSpeakers,
  getEventSponsors,
  getMedia,
  getPartnerOptions,
} from "@/lib/workspace-queries";

import { EventsWorkspace } from "./events-workspace";
import { NewEventButton, type CreatedEvent } from "./new-event-button";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; view?: string }>;
}) {
  const me = await requireModule("events");
  const writable = canWrite(me.modules, me.writeModules, "events");
  const { created: createdParam, view: rawView } = await searchParams;
  const [events, people, sponsors, committees, partners, eventOptions, savedViews, connections] =
    await Promise.all([
      getEvents(),
      getPeopleOptions(),
      getSponsorOptions(),
      getCommitteeOptions(),
      getPartnerOptions(),
      getEventOptions(),
      getSavedEventViews(me.id),
      getAllEventConnections(),
    ]);

  // After the create modal inserts an event it sets ?created=ID; we load that
  // event's attachments here so the modal's stage-2 cards show live data (every
  // card action revalidates /events, re-running this).
  const createdId = writable ? Number(createdParam) : NaN;
  let created: CreatedEvent | null = null;
  if (writable && Number.isFinite(createdId)) {
    const ev = await getEventById(createdId);
    if (ev) {
      const [media, speakers, eventSponsors, eventPartners, eventConnections] = await Promise.all([
        getMedia("event", createdId),
        getEventSpeakers(createdId).catch(() => []),
        getEventSponsors(createdId).catch(() => []),
        getEventPartners(createdId).catch(() => []),
        getEventConnections(createdId).catch(() => []),
      ]);
      created = {
        id: createdId,
        name: ev.name,
        media,
        speakers,
        eventSponsors,
        eventPartners,
        eventConnections,
      };
    }
  }

  // Initial view: explicit ?view= (built-in key or saved:ID), else All Events.
  const initialViewKey =
    rawView && (rawView.startsWith("saved:") || isBuiltInEventViewKey(rawView)) ? rawView : "all";

  return (
    <>
      <PageHeader
        title="Events"
        description="Every event the club is running. Click one to view."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Events" }]}
        action={
          <div className="flex gap-2">
            <Link href="/events/dusa" className={buttonSecondary}>
              DUSA pipeline
            </Link>
            {writable && (
              <NewEventButton
                people={people}
                sponsors={sponsors}
                partners={partners}
                committees={committees}
                eventOptions={eventOptions}
                created={created}
              />
            )}
          </div>
        }
      />

      <EventsWorkspace
        events={events}
        connections={connections}
        savedViews={savedViews}
        personId={me.personId}
        today={todayISO()}
        options={{ committees: committees.map((c) => c.name), leads: people }}
        initialViewKey={initialViewKey}
      />
    </>
  );
}
