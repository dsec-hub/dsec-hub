"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { performUndo } from "@/lib/undo-actions";
import type { ActionResult } from "@/lib/undo-types";

/**
 * Surface an action result as a Sonner toast: an error toast on failure, or a
 * success toast carrying an "Undo" button when the action returned an undo
 * token. `refresh` re-fetches the current route after an undo restores data
 * (server actions revalidate, but the already-rendered client tree needs a
 * nudge). Safe to call with `undefined` — it's a no-op until the action settles.
 */
export function showUndoToast(result: ActionResult, refresh: () => void): void {
  if (!result) return;
  if (result.error) {
    toast.error(result.error);
    return;
  }
  if (!result.ok) return;

  const token = result.undo;
  toast.success(result.message ?? "Done", {
    action: token
      ? {
          label: "Undo",
          onClick: async () => {
            const res = await performUndo(token);
            if (res?.error) {
              toast.error(res.error);
            } else {
              toast.success("Undone");
              refresh();
            }
          },
        }
      : undefined,
  });
}

/**
 * Fire the success/undo (or error) toast whenever a `useActionState` value
 * settles. Drop-in replacement for `useActionToast` on undoable forms.
 */
export function useUndoToast(state: ActionResult): void {
  const router = useRouter();
  useEffect(() => {
    showUndoToast(state, () => router.refresh());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}
