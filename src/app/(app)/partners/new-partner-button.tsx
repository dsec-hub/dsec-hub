"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { MediaManager } from "@/components/media-manager";
import { Modal } from "@/components/modal";
import { buttonPrimary, buttonSecondary } from "@/components/ui";
import type { MediaItem } from "@/lib/workspace-queries";

import { createPartner, type FormState } from "./actions";
import { PartnerForm } from "./partner-form";

/** The just-created partner plus its (initially empty) logo, fed by the list
 * page from `?created=ID`. */
export type CreatedPartner = {
  id: number;
  name: string;
  media: MediaItem[];
};

export function NewPartnerButton({ created }: { created?: CreatedPartner | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Two-stage modal. Stage 1 is the create form; on success we set `?created=ID`
  // and the server re-renders the page with `created`, flipping the SAME modal to
  // stage 2 (logo upload bound to the new partner). The MediaManager action
  // revalidates /partners, so the list's logo updates live.
  const showLogo = !!created;
  const isOpen = open || showLogo;

  const close = () => {
    setOpen(false);
    if (showLogo) router.replace("/partners", { scroll: false });
  };

  return (
    <>
      <button type="button" className={buttonPrimary} onClick={() => setOpen(true)}>
        New partner
      </button>
      <Modal
        open={isOpen}
        onClose={close}
        size="wide"
        title={showLogo ? `“${created!.name}” — add logo` : "New partner"}
      >
        {showLogo ? (
          <div className="space-y-6">
            <p className="text-sm text-muted">
              Partner created. Upload a logo now — or skip and add one later from the
              partner page.
            </p>
            <MediaManager entityType="partner" entityId={created!.id} existing={created!.media} />
            <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
              <Link href={`/partners/${created!.id}/edit`} className={buttonSecondary}>
                Open full page
              </Link>
              <button type="button" className={buttonPrimary} onClick={close}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <PartnerForm
            action={createPartner}
            onSuccess={(res: FormState) => {
              if (res?.id) router.replace(`/partners?created=${res.id}`, { scroll: false });
              else setOpen(false);
            }}
            onCancel={close}
          />
        )}
      </Modal>
    </>
  );
}
