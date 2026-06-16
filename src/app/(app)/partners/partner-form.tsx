"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { CheckboxField, Field, FormError, TextArea, TextInput } from "@/components/form";
import { SubmitButton } from "@/components/submit-button";
import { buttonSecondary } from "@/components/ui";
import { useUndoToast } from "@/lib/use-undo-toast";
import type { PartnerRow } from "@/lib/workspace-queries";

import type { FormState } from "./actions";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

export function PartnerForm({
  action,
  partner,
  onSuccess,
  onCancel,
  redirectOnSuccess,
  canWrite = true,
}: {
  action: Action;
  partner?: PartnerRow;
  onSuccess?: () => void;
  onCancel?: () => void;
  redirectOnSuccess?: string;
  canWrite?: boolean;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(action, undefined);
  useUndoToast(state);
  const p = partner;

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
          <Field label="Name" hint="Club / society / organisation name.">
            <TextInput name="name" required defaultValue={p?.name ?? ""} />
          </Field>
          <Field label="Website">
            <TextInput name="website" type="url" placeholder="https://…" defaultValue={p?.website ?? ""} />
          </Field>
        </div>

        <Field label="Notes" hint="Anything worth remembering about this collaborator.">
          <TextArea name="notes" defaultValue={p?.notes ?? ""} />
        </Field>

        <div className="space-y-1">
          <CheckboxField
            label="Show on website"
            name="show_on_website"
            defaultChecked={p?.showOnWebsite ?? false}
          />
          <p className="pl-[26px] text-xs text-muted">
            Publishes this partner’s logo on the public pages of the events it’s linked to (needs a logo uploaded).
          </p>
        </div>
      </fieldset>

      <div className="flex items-center gap-3">
        {canWrite ? (
          <SubmitButton>{partner ? "Save changes" : "Add partner"}</SubmitButton>
        ) : (
          <p className="text-sm text-muted">View only — you don’t have edit access for this section.</p>
        )}
        {onCancel ? (
          <button type="button" onClick={onCancel} className={buttonSecondary}>
            Cancel
          </button>
        ) : (
          <Link href="/partners" className={buttonSecondary}>
            Cancel
          </Link>
        )}
      </div>
    </form>
  );
}
