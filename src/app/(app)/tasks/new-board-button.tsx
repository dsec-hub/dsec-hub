"use client";

import { useState } from "react";

import { Modal } from "@/components/modal";
import { buttonSecondary } from "@/components/ui";

import { createBoard } from "./actions";
import { BoardForm } from "./board-form";

export function NewBoardButton({
  committees,
}: {
  committees: { id: number; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={buttonSecondary} onClick={() => setOpen(true)}>
        New board
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="New board">
        <BoardForm
          action={createBoard}
          committees={committees}
          onSuccess={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}
