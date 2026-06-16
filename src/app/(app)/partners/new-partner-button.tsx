"use client";

import { useState } from "react";

import { Modal } from "@/components/modal";
import { buttonPrimary } from "@/components/ui";

import { createPartner } from "./actions";
import { PartnerForm } from "./partner-form";

export function NewPartnerButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={buttonPrimary} onClick={() => setOpen(true)}>
        New partner
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="New partner">
        <PartnerForm
          action={createPartner}
          onSuccess={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}
