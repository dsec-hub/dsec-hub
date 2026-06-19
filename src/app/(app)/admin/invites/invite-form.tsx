"use client";

import { useActionState } from "react";

import { CommitteeSelect } from "@/components/committee-select";
import { Field, FormError, SelectField, TextInput } from "@/components/form";
import { SubmitButton } from "@/components/submit-button";
import { useActionToast } from "@/lib/use-action-toast";
import { createInvite } from "./actions";
import { CopyLink } from "./copy-link";

export function InviteForm({
  roles,
  committees,
}: {
  roles: { id: number; name: string }[];
  committees: { id: number; name: string }[];
}) {
  const [state, formAction] = useActionState(createInvite, undefined);
  useActionToast(state);

  return (
    <div className="space-y-4">
      <form action={formAction} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" hint="Optional — adds them to People right away.">
            <TextInput name="name" placeholder="Jane Doe" autoComplete="off" />
          </Field>
          <Field label="Email">
            <TextInput type="email" name="email" required placeholder="name@example.com" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Role" hint="Access level in the dashboard.">
            <SelectField name="role_id" required defaultValue="">
              <option value="" disabled>
                Choose…
              </option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </SelectField>
          </Field>
          <Field label="Committee">
            <CommitteeSelect committees={committees} />
          </Field>
          <Field label="Position" hint="Their title, e.g. Events Lead.">
            <TextInput name="role_title" placeholder="e.g. Events Lead" autoComplete="off" />
          </Field>
        </div>
        <SubmitButton className="w-full sm:w-auto sm:self-end">Send invite</SubmitButton>
      </form>

      {state && "error" in state && <FormError>{state.error}</FormError>}

      {state && "ok" in state && (
        <div className="rounded-lg border border-border bg-elevated/50 p-4">
          <p className="text-sm">
            {state.sent ? (
              <>
                Invite emailed to <span className="font-medium">{state.email}</span>.
              </>
            ) : (
              <span className="text-warning">{state.warning}</span>
            )}
          </p>
          <CopyLink link={state.link} />
        </div>
      )}
    </div>
  );
}
