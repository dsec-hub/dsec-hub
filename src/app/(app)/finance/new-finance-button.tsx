"use client";

import { useState } from "react";

import { Modal } from "@/components/modal";
import { buttonPrimary } from "@/components/ui";

import { createFinance } from "./actions";
import { FinanceForm } from "./finance-form";

export function NewFinanceButton({
  events,
}: {
  events: { id: number; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={buttonPrimary} onClick={() => setOpen(true)}>
        New item
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="New item">
        <FinanceForm
          action={createFinance}
          events={events}
          onSuccess={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}
