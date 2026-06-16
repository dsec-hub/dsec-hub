"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Fire a Sonner error toast whenever a server-action result carries an error.
 * Accepts any `useActionState` value: a bare error string (the next-auth
 * `authenticate` action) or a state object with an `error` field (the workspace
 * CRUD forms, including ones that also return success fields). No-op while the
 * state is empty/clean, so it's safe to call unconditionally after
 * `useActionState`.
 */
export function useActionToast(state: unknown): void {
  useEffect(() => {
    let error: unknown;
    if (typeof state === "string") error = state;
    else if (state && typeof state === "object" && "error" in state) {
      error = (state as { error?: unknown }).error;
    }
    if (typeof error === "string" && error) toast.error(error);
  }, [state]);
}
