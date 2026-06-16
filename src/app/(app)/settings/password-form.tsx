"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";

import { Field, FormError, TextInput } from "@/components/form";
import { SubmitButton } from "@/components/submit-button";
import { useActionToast } from "@/lib/use-action-toast";
import { changePassword } from "./actions";

export function PasswordForm() {
  const [state, formAction] = useActionState(changePassword, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useActionToast(state);

  useEffect(() => {
    if (state?.ok) {
      toast.success("Password changed.");
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-5">
      <FormError>{state?.error}</FormError>
      <fieldset className="rounded-xl border border-border p-4">
        <legend className="px-1 text-xs text-muted">Change password</legend>
        <div className="space-y-5">
          <Field label="Current password">
            <TextInput name="current_password" type="password" required autoComplete="current-password" />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="New password" hint="At least 12 characters.">
              <TextInput name="new_password" type="password" required autoComplete="new-password" />
            </Field>
            <Field label="Confirm new password">
              <TextInput name="confirm_password" type="password" required autoComplete="new-password" />
            </Field>
          </div>
        </div>
      </fieldset>
      <SubmitButton>Update password</SubmitButton>
    </form>
  );
}
