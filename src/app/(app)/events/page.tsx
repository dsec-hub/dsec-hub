import Link from "next/link";

import { PageHeader, buttonSecondary } from "@/components/ui";
import { getCommitteeOptions } from "@/lib/committee-queries";
import { requireModule } from "@/lib/dal";
import { todayISO } from "@/lib/format";
import { getEventById, getEvents, getPeopleOptions, getSponsorOptions } from "@/lib/queries";
import { canWrite } from "@/lib/rbac";
import {
  getEventConnections,
  getEventOptions,
  getEventPartners,
  getEventSpeakers,
  getEventSponsors,
  getMedia,
  getPartnerOptions,
} from "@/lib/workspace-queries";

import { EventsView } from "./events-view";
import { NewEventButton, type CreatedEvent } from "./new-event-button";

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const me = await requireModule("events");
  const writable = canWrite(me.modules, me.writeModules, "events");
  const [events, people, sponsors, committees, partners, eventOptions] = await Promise.all([
    getEvents(),
    getPeopleOptions(),
    getSponsorOptions(),
    getCommitteeOptions(),
    getPartnerOptions(),
    getEventOptions(),
  ]);

  // After the create modal inserts an event it sets ?created=ID; we load that
  // event's attachments here so the modal's stage-2 cards show live data (every
  // card action revalidates /events, re-running this).
  const createdId = writable ? Number((await searchParams).created) : NaN;
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

      <EventsView events={events} today={todayISO()} />
    </>
  );
}
