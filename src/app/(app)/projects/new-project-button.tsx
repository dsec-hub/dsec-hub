"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { MediaManager } from "@/components/media-manager";
import { Modal } from "@/components/modal";
import { buttonPrimary, buttonSecondary } from "@/components/ui";
import type { MediaItem, Option } from "@/lib/workspace-queries";

import { createProject, type FormState } from "./actions";
import { ProjectForm } from "./project-form";

/** The just-created project plus its (initially empty) images, fed by the list
 * page from `?created=ID`. */
export type CreatedProject = { id: number; name: string; media: MediaItem[] };

export function NewProjectButton({
  people,
  events,
  created,
}: {
  people: Option[];
  events: Option[];
  created?: CreatedProject | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Two-stage modal — see NewEventButton for the full rationale. Stage 2 here is
  // just the image manager (projects have no speakers/sponsors).
  const showExtras = !!created;
  const isOpen = open || showExtras;

  const close = () => {
    setOpen(false);
    if (showExtras) router.replace("/projects", { scroll: false });
  };

  return (
    <>
      <button type="button" className={buttonPrimary} onClick={() => setOpen(true)}>
        New project
      </button>
      <Modal
        open={isOpen}
        onClose={close}
        size="wide"
        title={showExtras ? `“${created!.name}” — add images` : "New project"}
      >
        {showExtras ? (
          <div className="space-y-6">
            <p className="text-sm text-muted">
              Project created. Add images now — or skip and finish later from the project page.
            </p>
            <MediaManager entityType="project" entityId={created!.id} existing={created!.media} />
            <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
              <Link href={`/projects/${created!.id}/edit`} className={buttonSecondary}>
                Open full page
              </Link>
              <button type="button" className={buttonPrimary} onClick={close}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <ProjectForm
            action={createProject}
            people={people}
            events={events}
            onSuccess={(res: FormState) => {
              if (res?.id) router.replace(`/projects?created=${res.id}`, { scroll: false });
              else setOpen(false);
            }}
            onCancel={close}
          />
        )}
      </Modal>
    </>
  );
}
