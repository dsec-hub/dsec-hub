"use client";

import { useActionState } from "react";

import { Field, FormError, TextInput } from "@/components/form";
import { SubmitButton } from "@/components/submit-button";
import { useActionToast } from "@/lib/use-action-toast";
import { acceptInvite, type AcceptState } from "./actions";

export function AcceptForm({
  token,
  email,
  defaultName,
}: {
  token: string;
  email: string;
  defaultName?: string;
}) {
  const action = acceptInvite.bind(null, token);
  const [state, formAction] = useActionState<AcceptState, FormData>(action, undefined);
  useActionToast(state);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormError>{state?.error}</FormError>

      <Field label="Email">
        <TextInput value={email} disabled readOnly />
      </Field>

      <Field label="Your name">
        <TextInput name="name" defaultValue={defaultName ?? ""} autoComplete="name" />
      </Field>

      <Field label="Password" hint="At least 12 characters.">
        <TextInput type="password" name="password" required autoComplete="new-password" />
      </Field>

      <Field label="Confirm password">
        <TextInput type="password" name="confirm" required autoComplete="new-password" />
      </Field>

      <SubmitButton className="mt-1 w-full">Set password & continue</SubmitButton>
    </form>
  );
}
