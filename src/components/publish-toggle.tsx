"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { buttonGhost, buttonSecondary } from "@/components/ui";
import { cn } from "@/lib/format";
import { showUndoToast } from "@/lib/use-undo-toast";
import type { ActionResult } from "@/lib/undo-types";

/**
 * Draft ⇄ Published toggle for an event/project. `action` is a server action
 * already bound to the row id, e.g. `setEventPublished.bind(null, eventId)`, and
 * takes the desired published state. The server enforces the publish gate (e.g.
 * an event needs a start date) and returns an error result, which surfaces as a
 * toast. When already published it offers "Unpublish"; the toast carries Undo.
 *
 * `blockedReason`, when set, disables the Publish button with an explanatory
 * tooltip so it's clear *why* it can't go live yet (the server still re-checks).
 */
export function PublishToggle({
  published,
  action,
  blockedReason,
}: {
  published: boolean;
  action: (published: boolean) => Promise<ActionResult>;
  blockedReason?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(next: boolean) {
    startTransition(async () => {
      const res = await action(next);
      showUndoToast(res, () => router.refresh());
    });
  }

  if (published) {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => run(false)}
        className={buttonGhost}
        title="Hide this from the public website"
      >
        {pending ? "…" : "Unpublish"}
      </button>
    );
  }

  const blocked = !!blockedReason;
  return (
    <button
      type="button"
      disabled={pending || blocked}
      onClick={() => run(true)}
      title={blockedReason ?? "Make this live on the public website"}
      className={cn(buttonSecondary, blocked && "cursor-not-allowed opacity-60")}
    >
      {pending ? "…" : "Publish"}
    </button>
  );
}
