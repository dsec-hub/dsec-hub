"use client";

import { useActionState } from "react";

import { authenticate } from "./actions";
import { useActionToast } from "@/lib/use-action-toast";

export function SignInForm() {
  const [errorMessage, formAction, pending] = useActionState(
    authenticate,
    undefined,
  );
  useActionToast(errorMessage);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
        />
      </label>

      {errorMessage && (
        <p className="text-sm text-danger" role="alert">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
