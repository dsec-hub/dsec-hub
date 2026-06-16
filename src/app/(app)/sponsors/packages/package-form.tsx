"use client";

import { useActionState } from "react";

import { CheckboxField, Field, FormError, TextArea, TextInput } from "@/components/form";
import { SubmitButton } from "@/components/submit-button";
import type { SponsorPackageRow } from "@/lib/queries";

import type { FormState } from "./actions";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

export function PackageForm({
  action,
  pkg,
  onSuccess,
  onCancel,
}: {
  action: Action;
  pkg?: SponsorPackageRow;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, { ok: false });

  if (state?.ok && onSuccess) {
    onSuccess();
    return null;
  }

  const includedText = (pkg?.includes ?? []).join("\n");

  return (
    <form action={formAction} className="grid gap-4">
      <Field label="Tier name" htmlFor="name">
        <TextInput
          id="name"
          name="name"
          required
          defaultValue={pkg?.name ?? ""}
          placeholder="e.g. Supporter"
        />
      </Field>

      <Field label="Pitch" htmlFor="pitch" hint="One-line tagline shown under the name.">
        <TextInput
          id="pitch"
          name="pitch"
          defaultValue={pkg?.pitch ?? ""}
          placeholder="Get on the radar of Deakin's best coders."
        />
      </Field>

      <Field
        label="Price (display string)"
        htmlFor="price"
        hint="Shown after the lead unlocks pricing. E.g. 'from $500'."
      >
        <TextInput
          id="price"
          name="price"
          defaultValue={pkg?.price ?? ""}
          placeholder="from $500"
        />
      </Field>

      <Field
        label="What's included"
        htmlFor="includes"
        hint="One perk per line. Rendered as a bullet list on the website."
      >
        <TextArea
          id="includes"
          name="includes"
          rows={5}
          defaultValue={includedText}
          placeholder={"Logo on DSEC site + Discord\nShout-out at one event\nJob posts shared to members"}
        />
      </Field>

      <Field label="Display order" htmlFor="display_order" hint="Lower = shown first.">
        <TextInput
          id="display_order"
          name="display_order"
          type="number"
          defaultValue={pkg?.displayOrder ?? 0}
        />
      </Field>

      <div className="flex flex-col gap-2">
        <CheckboxField
          name="featured"
          label="Featured (highlighted card)"
          defaultChecked={pkg?.featured ?? false}
        />
        <CheckboxField
          name="is_visible"
          label="Visible on public website"
          defaultChecked={pkg?.isVisible ?? true}
        />
      </div>

      <FormError>{state?.error}</FormError>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-ghost btn">
            Cancel
          </button>
        )}
        <SubmitButton>{pkg ? "Save changes" : "Create package"}</SubmitButton>
      </div>
    </form>
  );
}
