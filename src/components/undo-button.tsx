"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { showUndoToast } from "@/lib/use-undo-toast";
import type { ActionResult } from "@/lib/undo-types";

/**
 * Runs a (bound) server action that returns an `ActionResult`, then shows a
 * toast whose "Undo" button reverses it. Replaces `ConfirmButton` for the
 * Archive / Delete affordances on edit pages: unlike a plain `<form>` submit it
 * reads the action's return value (so it can offer Undo) and navigates
 * client-side via `redirectTo`. Pass `confirm` for a window.confirm gate
 * (delete); omit it for archive.
 */
export function UndoButton({
  action,
  children,
  className,
  confirm,
  redirectTo,
  pendingLabel,
}: {
  action: () => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
  confirm?: string;
  redirectTo?: string;
  pendingLabel?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className={className}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        startTransition(async () => {
          const res = await action();
          showUndoToast(res, () => router.refresh());
          if (!res?.error && redirectTo) router.push(redirectTo);
        });
      }}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
