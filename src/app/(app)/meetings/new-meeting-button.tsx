"use client";

import { useState } from "react";

import { Modal } from "@/components/modal";
import { buttonPrimary } from "@/components/ui";
import type { Option } from "@/lib/workspace-queries";

import { createMeeting } from "./actions";
import { MeetingForm } from "./meeting-form";

export function NewMeetingButton({
  events,
  people,
}: {
  events: Option[];
  people: Option[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={buttonPrimary} onClick={() => setOpen(true)}>
        New meeting
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="New meeting">
        <MeetingForm
          action={createMeeting}
          events={events}
          people={people}
          onSuccess={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}
