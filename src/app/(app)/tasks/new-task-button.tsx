"use client";

import { useState } from "react";

import { Modal } from "@/components/modal";
import { buttonPrimary } from "@/components/ui";

import { createTask } from "./actions";
import { TaskForm } from "./task-form";

type Option = { id: number; name: string };

export function NewTaskButton({
  boards,
  people,
  events,
  projects,
  committees,
}: {
  boards: Option[];
  people: Option[];
  events: Option[];
  projects: Option[];
  committees: Option[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={buttonPrimary} onClick={() => setOpen(true)}>
        New task
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="New task">
        <TaskForm
          action={createTask}
          boards={boards}
          people={people}
          events={events}
          projects={projects}
          committees={committees}
          onSuccess={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}
