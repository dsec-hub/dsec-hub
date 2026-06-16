"use client";

import { useTransition } from "react";

import { buttonGhost, buttonSecondary } from "@/components/ui";
import type { SponsorLeadRow } from "@/lib/queries";

import { updateLeadStatus } from "./actions";

const NEXT_STATUS: Record<string, { label: string; status: string }> = {
  new: { label: "Mark contacted", status: "contacted" },
  contacted: { label: "Mark converted", status: "converted" },
};

export function LeadActions({ lead, canWrite }: { lead: SponsorLeadRow; canWrite: boolean }) {
  const [isPending, startTransition] = useTransition();

  const next = NEXT_STATUS[lead.status];

  function advance() {
    if (!next) return;
    startTransition(() => { void updateLeadStatus(lead.id, next.status); });
  }

  function close() {
    startTransition(() => { void updateLeadStatus(lead.id, "closed"); });
  }

  if (!canWrite) return null;

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {next && (
        <button
          type="button"
          className={buttonSecondary}
          onClick={advance}
          disabled={isPending}
        >
          {isPending ? "…" : next.label}
        </button>
      )}
      {lead.status !== "closed" && lead.status !== "converted" && (
        <button
          type="button"
          className={buttonGhost}
          onClick={close}
          disabled={isPending}
          title="Close lead"
        >
          ✕
        </button>
      )}
    </div>
  );
}
