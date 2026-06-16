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
import { SubmitButton } from "@/components/submit-button";
import { TagCheckboxGroup } from "@/components/tag-checkbox-group";
import { buttonSecondary } from "@/components/ui";
import { RELATIONSHIP_TYPES, SPONSOR_STAGES, SPONSOR_TIERS, SUPPORT_TYPES } from "@/lib/options";
import { useUndoToast } from "@/lib/use-undo-toast";
import type { FormState } from "./actions";
import type { SponsorRow } from "@/lib/queries";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

export function SponsorForm({
  action,
  people,
  sponsor,
  onSuccess,
  onCancel,
  redirectOnSuccess,
  canWrite = true,
}: {
  action: Action;
  people: { id: number; name: string }[];
  sponsor?: SponsorRow;
  onSuccess?: (result: FormState) => void;
  onCancel?: () => void;
  redirectOnSuccess?: string;
  canWrite?: boolean;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(action, undefined);
  useUndoToast(state);
  const s = sponsor;

  useEffect(() => {
    if (!state?.ok) return;
    if (onSuccess) onSuccess(state);
    else if (redirectOnSuccess) router.push(redirectOnSuccess);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      <fieldset disabled={!canWrite} className="space-y-6">
        <FormError>{state?.error}</FormError>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Organisation">
            <TextInput name="organisation" required defaultValue={s?.organisation ?? ""} />
          </Field>
          <Field label="Relationship" hint="Partners give in-kind support, not money.">
            <SelectField name="relationship_type" defaultValue={s?.relationshipType ?? "Sponsor"}>
              {RELATIONSHIP_TYPES.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </SelectField>
          </Field>
          <Field label="Stage">
            <SelectField name="stage" defaultValue={s?.stage ?? "Prospect"}>
              {SPONSOR_STAGES.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </SelectField>
          </Field>
          <Field label="Tier">
            <SelectField name="tier" defaultValue={s?.tier ?? ""}>
              <option value="">—</option>
              {SPONSOR_TIERS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </SelectField>
          </Field>
          <Field label="Value (AUD)" hint="Leave blank for in-kind support (no cash).">
            <TextInput
              type="number"
              step="0.01"
              name="value_aud"
              defaultValue={s?.valueAud ?? ""}
            />
          </Field>
          <Field label="Contact">
            <SelectField
              name="contact_person_id"
              defaultValue={s?.contactPersonId ? String(s.contactPersonId) : ""}
            >
              <option value="">—</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </SelectField>
          </Field>
        </div>

        <Field label="Type of support" hint="What they provide — cash and/or in-kind.">
          <TagCheckboxGroup
            name="support_types"
            options={SUPPORT_TYPES}
            defaultValue={s?.supportTypes}
          />
        </Field>

        <CheckboxField
          label="DUSA approved"
          name="dusa_approved"
          defaultChecked={s?.dusaApproved ?? false}
        />

        <div className="space-y-1">
          <CheckboxField
            label="Show on website"
            name="show_on_website"
            defaultChecked={s?.showOnWebsite ?? false}
          />
          <p className="pl-[26px] text-xs text-muted">
            Publishes this sponsor’s logo on the public sponsor wall (needs a logo uploaded).
          </p>
        </div>

        <Field label="Notes">
          <TextArea name="notes" defaultValue={s?.notes ?? ""} />
        </Field>
      </fieldset>

      <div className="flex items-center gap-3">
        {canWrite ? (
          <SubmitButton>{sponsor ? "Save changes" : "Add sponsor"}</SubmitButton>
        ) : (
          <p className="text-sm text-muted">View only — you don’t have edit access for this section.</p>
        )}
        {onCancel ? (
          <button type="button" onClick={onCancel} className={buttonSecondary}>
            Cancel
          </button>
        ) : (
          <Link href="/sponsors" className={buttonSecondary}>
            Cancel
          </Link>
        )}
      </div>
    </form>
  );
}
