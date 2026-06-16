"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import {
  CheckboxField,
  Field,
  FormError,
  SelectField,
  TextArea,
  TextInput,
} from "@/components/form";
import { DateField } from "@/components/date-field";
import { SubmitButton } from "@/components/submit-button";
import { buttonSecondary } from "@/components/ui";
import { FINANCE_STATUSES, FINANCE_TYPES } from "@/lib/options";
import { useUndoToast } from "@/lib/use-undo-toast";
import type { FormState } from "./actions";
import type { FinanceRow } from "@/lib/queries";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

export function FinanceForm({
  action,
  events,
  entry,
  canWrite = true,
  onSuccess,
  onCancel,
  redirectOnSuccess,
}: {
  action: Action;
  events: { id: number; name: string }[];
  entry?: FinanceRow;
  canWrite?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
  redirectOnSuccess?: string;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(action, undefined);
  useUndoToast(state);
  const f = entry;

  useEffect(() => {
    if (!state?.ok) return;
    if (onSuccess) onSuccess();
    else if (redirectOnSuccess) router.push(redirectOnSuccess);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      <fieldset disabled={!canWrite} className="space-y-6">
        <FormError>{state?.error}</FormError>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Item">
            <TextInput name="item" required defaultValue={f?.item ?? ""} />
          </Field>
          <Field label="Type">
            <SelectField name="type" defaultValue={f?.type ?? "Other Expense"}>
              {FINANCE_TYPES.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </SelectField>
          </Field>
          <Field label="Amount (AUD)">
            <TextInput
              type="number"
              step="0.01"
              name="amount_aud"
              defaultValue={f?.amountAud ?? ""}
            />
          </Field>
          <Field label="Status">
            <SelectField name="status" defaultValue={f?.status ?? "Requested"}>
              {FINANCE_STATUSES.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </SelectField>
          </Field>
          <Field label="Date requested">
            <DateField name="date_requested" defaultValue={f?.dateRequested ?? ""} />
          </Field>
          <Field label="Date paid">
            <DateField name="date_paid" defaultValue={f?.datePaid ?? ""} />
          </Field>
          <Field label="Related event">
            <SelectField
              name="related_event_id"
              defaultValue={f?.relatedEventId ? String(f.relatedEventId) : ""}
            >
              <option value="">—</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </SelectField>
          </Field>
        </div>

        <CheckboxField
          label="GST included"
          name="gst_included"
          defaultChecked={f?.gstIncluded ?? false}
        />

        <Field label="Notes">
          <TextArea name="notes" defaultValue={f?.notes ?? ""} />
        </Field>
      </fieldset>

      <div className="flex items-center gap-3">
        {canWrite ? (
          <SubmitButton>{entry ? "Save changes" : "Add item"}</SubmitButton>
        ) : (
          <p className="text-sm text-muted">View only — you don’t have edit access for this section.</p>
        )}
        {onCancel ? (
          <button type="button" onClick={onCancel} className={buttonSecondary}>
            Cancel
          </button>
        ) : (
          <Link href="/finance" className={buttonSecondary}>
            Cancel
          </Link>
        )}
      </div>
    </form>
  );
}
