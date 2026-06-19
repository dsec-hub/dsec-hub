"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";

import { Field, FormError, TextInput } from "@/components/form";
import { SubmitButton } from "@/components/submit-button";
import { useActionToast } from "@/lib/use-action-toast";
import { changeEmail } from "./actions";

/**
 * Change the email used to sign in. The current email is shown read-only for
 * context; the new address plus the current password are required, since this
 * swaps a login credential.
 */
export function ChangeEmailForm({ currentEmail }: { currentEmail: string }) {
  const [state, formAction] = useActionState(changeEmail, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useActionToast(state);

  useEffect(() => {
    if (state?.ok) {
      toast.success("Email updated.");
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-5">
      <FormError>{state?.error}</FormError>
      <fieldset className="rounded-xl border border-border p-4">
        <legend className="px-1 text-xs text-muted">Change email</legend>
        <div className="space-y-5">
          <Field label="Current email">
            <TextInput value={currentEmail} disabled readOnly autoComplete="off" />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="New email">
              <TextInput name="email" type="email" required autoComplete="email" />
            </Field>
            <Field label="Current password" hint="Confirms it's really you.">
              <TextInput
                name="current_password"
                type="password"
                required
                autoComplete="current-password"
              />
            </Field>
          </div>
        </div>
      </fieldset>
      <SubmitButton>Update email</SubmitButton>
    </form>
  );
}
