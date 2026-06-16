"use client";

import { useActionState } from "react";

import { Field, FormError, SelectField, TextInput } from "@/components/form";
import { SubmitButton } from "@/components/submit-button";
import { useActionToast } from "@/lib/use-action-toast";
import type { Option } from "@/lib/workspace-queries";

import type { BudgetState } from "./budget-actions";

export function BudgetForm({
  action,
  events,
}: {
  action: (prev: BudgetState, fd: FormData) => Promise<BudgetState>;
  events: Option[];
}) {
  const [state, formAction] = useActionState(action, undefined);
  useActionToast(state);
  return (
    <form action={formAction} className="space-y-3 p-5">
      <FormError>{state?.error}</FormError>
      {state?.ok && (
        <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success" role="status">
          {state.ok}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <Field label="Event">
          <SelectField name="event_id" required defaultValue="">
            <option value="" disabled>
              Choose an event…
            </option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </SelectField>
        </Field>
        <Field label="Budget (AUD)">
          <TextInput name="budget_aud" type="number" step="0.01" min="0" placeholder="300" required />
        </Field>
        <SubmitButton>Set budget</SubmitButton>
      </div>
    </form>
  );
}
