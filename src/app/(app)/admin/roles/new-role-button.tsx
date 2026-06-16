"use client";

import { useState } from "react";

import { Modal } from "@/components/modal";
import { buttonPrimary } from "@/components/ui";

import { createRole } from "./actions";
import { RoleForm } from "./role-form";

export function NewRoleButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={buttonPrimary} onClick={() => setOpen(true)}>
        New role
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="New role">
        <RoleForm
          action={createRole}
          onSuccess={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}
