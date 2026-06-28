"use client";

import { useActionState } from "react";

import { Field, FormError, SelectField, TextInput } from "@/components/form";
import { SubmitButton } from "@/components/submit-button";
import { useUndoToast } from "@/lib/use-undo-toast";

import { saveLinkProfile } from "./actions";

/** Curated subset of the real PixelDuck sprites in dsec-website/public/pixel/
 * (the duck-*.webp mascots). KEEP these names in sync with that folder. */
const MASCOTS = [
  "duck-mascot",
  "duck-wave",
  "duck-coffee",
  "duck-laptop",
  "duck-rocket",
  "duck-trophy",
  "duck-mail",
  "duck-iso",
] as const;

type ProfileLike = {
  title: string;
  tagline: string | null;
  mascot: string | null;
};

export function ProfileForm({
  profile,
  canWrite = true,
}: {
  profile: ProfileLike;
  canWrite?: boolean;
}) {
  const [state, formAction] = useActionState(saveLinkProfile, undefined);
  useUndoToast(state);
  const mascot = profile.mascot ?? "duck-mascot";

  return (
    <form action={formAction} className="space-y-5">
      <fieldset disabled={!canWrite} className="space-y-5">
        <FormError>{state?.error}</FormError>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Title" hint="The big heading at the top of the page.">
            <TextInput name="title" required maxLength={60} defaultValue={profile.title} />
          </Field>
          <Field label="Tagline" hint="A sub-heading under the title (optional).">
            <TextInput name="tagline" maxLength={160} defaultValue={profile.tagline ?? ""} />
          </Field>
        </div>

        <Field label="Mascot" hint="The PixelDuck sprite shown above the title.">
          <SelectField name="mascot" defaultValue={MASCOTS.includes(mascot as (typeof MASCOTS)[number]) ? mascot : "duck-mascot"}>
            {MASCOTS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </SelectField>
        </Field>
      </fieldset>

      {canWrite && <SubmitButton>Save profile</SubmitButton>}
    </form>
  );
}
