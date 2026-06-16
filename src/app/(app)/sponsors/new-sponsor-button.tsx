"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { MediaManager } from "@/components/media-manager";
import { Modal } from "@/components/modal";
import { buttonPrimary, buttonSecondary } from "@/components/ui";
import type { MediaItem } from "@/lib/workspace-queries";

import { createSponsor, type FormState } from "./actions";
import { SponsorForm } from "./sponsor-form";

/** The just-created sponsor plus its (initially empty) logo, fed by the list
 * page from `?created=ID`. */
export type CreatedSponsor = {
  id: number;
  name: string;
  media: MediaItem[];
};

export function NewSponsorButton({
  people,
  created,
}: {
  people: { id: number; name: string }[];
  created?: CreatedSponsor | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Two-stage modal. Stage 1 is the create form; on success we set `?created=ID`
  // and the server re-renders the page with `created`, flipping the SAME modal to
  // stage 2 (logo upload bound to the new sponsor). The MediaManager action
  // revalidates /sponsors, so the list updates live.
  const showLogo = !!created;
  const isOpen = open || showLogo;

  const close = () => {
    setOpen(false);
    if (showLogo) router.replace("/sponsors", { scroll: false });
  };

  return (
    <>
      <button type="button" className={buttonPrimary} onClick={() => setOpen(true)}>
        New sponsor
      </button>
      <Modal
        open={isOpen}
        onClose={close}
        size="wide"
        title={showLogo ? `“${created!.name}” — add logo` : "New sponsor"}
      >
        {showLogo ? (
          <div className="space-y-6">
            <p className="text-sm text-muted">
              Sponsor created. Upload their brand logo now — or skip and add one later
              from the sponsor page.
            </p>
            <MediaManager entityType="sponsor" entityId={created!.id} existing={created!.media} />
            <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
              <Link href={`/sponsors/${created!.id}/edit`} className={buttonSecondary}>
                Open full page
              </Link>
              <button type="button" className={buttonPrimary} onClick={close}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <SponsorForm
            action={createSponsor}
            people={people}
            onSuccess={(res: FormState) => {
              if (res?.id) router.replace(`/sponsors?created=${res.id}`, { scroll: false });
              else setOpen(false);
            }}
            onCancel={close}
          />
        )}
      </Modal>
    </>
  );
}
