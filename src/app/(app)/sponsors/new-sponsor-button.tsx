"use client";

import { useState } from "react";

import { Modal } from "@/components/modal";
import { buttonPrimary } from "@/components/ui";

import { createSponsor } from "./actions";
import { SponsorForm } from "./sponsor-form";

export function NewSponsorButton({
  people,
}: {
  people: { id: number; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={buttonPrimary} onClick={() => setOpen(true)}>
        New sponsor
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="New sponsor">
        <SponsorForm
          action={createSponsor}
          people={people}
          onSuccess={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}
