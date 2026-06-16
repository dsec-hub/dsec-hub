"use client";

import { useState } from "react";

import { Modal } from "@/components/modal";
import { buttonPrimary } from "@/components/ui";

import { createCommittee } from "./actions";
import { CommitteeForm } from "./committee-form";

export function NewCommitteeButton({
  people,
}: {
  people: { id: number; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={buttonPrimary} onClick={() => setOpen(true)}>
        New committee
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="New committee">
        <CommitteeForm
          action={createCommittee}
          people={people}
          onSuccess={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}
