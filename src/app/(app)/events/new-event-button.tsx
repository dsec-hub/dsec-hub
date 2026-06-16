"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { MediaManager } from "@/components/media-manager";
import { Modal } from "@/components/modal";
import { buttonPrimary, buttonSecondary } from "@/components/ui";
import type {
  EventConnectionRow,
  EventPartnerRow,
  EventSpeakerRow,
  EventSponsorRow,
  MediaItem,
  Option,
} from "@/lib/workspace-queries";

import { createEvent, type FormState } from "./actions";
import { EventForm } from "./event-form";
import { EventConnections } from "./[id]/event-connections";
import { EventPartners } from "./[id]/event-partners";
import { EventSpeakers } from "./[id]/event-speakers";
import { EventSponsors } from "./[id]/event-sponsors";

/** The just-created event plus its (initially empty) attachments, fed by the
 * list page from `?created=ID`. */
export type CreatedEvent = {
  id: number;
  name: string;
  media: MediaItem[];
  speakers: EventSpeakerRow[];
  eventSponsors: EventSponsorRow[];
  eventPartners: EventPartnerRow[];
  eventConnections: EventConnectionRow[];
};

export function NewEventButton({
  people,
  sponsors,
  partners,
  committees,
  eventOptions,
  created,
}: {
  people: Option[];
  sponsors: Option[];
  partners: Option[];
  committees: Option[];
  eventOptions: Option[];
  created?: CreatedEvent | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Two-stage modal. Stage 1 is the create form; on success we set `?created=ID`
  // and the server re-renders the page with `created`, flipping the SAME modal to
  // stage 2 (images / speakers / sponsors / partners). Because each card's action
  // revalidates /events, those lists update live as the user adds to them.
  const showExtras = !!created;
  const isOpen = open || showExtras;

  const close = () => {
    setOpen(false);
    if (showExtras) router.replace("/events", { scroll: false });
  };

  return (
    <>
      <button type="button" className={buttonPrimary} onClick={() => setOpen(true)}>
        New event
      </button>
      <Modal
        open={isOpen}
        onClose={close}
        title={showExtras ? `“${created!.name}” — add images & details` : "New event"}
      >
        {showExtras ? (
          <EventExtras
            created={created!}
            people={people}
            sponsors={sponsors}
            partners={partners}
            eventOptions={eventOptions}
            onDone={close}
          />
        ) : (
          <EventForm
            action={createEvent}
            people={people}
            committees={committees}
            onSuccess={(res: FormState) => {
              if (res?.id) router.replace(`/events?created=${res.id}`, { scroll: false });
              else setOpen(false);
            }}
            onCancel={close}
          />
        )}
      </Modal>
    </>
  );
}

function EventExtras({
  created,
  people,
  sponsors,
  partners,
  eventOptions,
  onDone,
}: {
  created: CreatedEvent;
  people: Option[];
  sponsors: Option[];
  partners: Option[];
  eventOptions: Option[];
  onDone: () => void;
}) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        Event created. Add images, speakers, sponsors, partners, and related events
        now — or skip and finish later from the event page.
      </p>
      <MediaManager entityType="event" entityId={created.id} existing={created.media} />
      <EventSpeakers eventId={created.id} speakers={created.speakers} people={people} canWrite />
      <EventSponsors
        eventId={created.id}
        linked={created.eventSponsors}
        sponsorOptions={sponsors}
        canWrite
      />
      <EventPartners
        eventId={created.id}
        linked={created.eventPartners}
        partnerOptions={partners}
        canWrite
      />
      <EventConnections
        eventId={created.id}
        linked={created.eventConnections}
        eventOptions={eventOptions}
        canWrite
      />
      <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
        <Link href={`/events/${created.id}/edit`} className={buttonSecondary}>
          Open full page
        </Link>
        <button type="button" className={buttonPrimary} onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  );
}
