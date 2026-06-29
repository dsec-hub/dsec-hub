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
  instagram?: string | null;
  discord?: string | null;
  linkedin?: string | null;
  github?: string | null;
  email?: string | null;
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

        <div className="space-y-1 border-t border-border pt-5">
          <p className="text-sm font-semibold">Socials</p>
          <p className="text-xs text-muted">
            The club&apos;s canonical links. Set them once here and they feed the
            /links page, the website &amp; portal footers, and the contact / scan
            / join pages. Leave a field blank to hide that platform everywhere.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Instagram" hint="Full profile URL (https://instagram.com/…).">
            <TextInput
              name="instagram"
              type="url"
              maxLength={512}
              placeholder="https://instagram.com/dsec"
              defaultValue={profile.instagram ?? ""}
            />
          </Field>
          <Field label="Discord" hint="Permanent invite URL (https://discord.gg/…).">
            <TextInput
              name="discord"
              type="url"
              maxLength={512}
              placeholder="https://discord.gg/…"
              defaultValue={profile.discord ?? ""}
            />
          </Field>
          <Field label="LinkedIn" hint="Company/page URL.">
            <TextInput
              name="linkedin"
              type="url"
              maxLength={512}
              placeholder="https://www.linkedin.com/company/…"
              defaultValue={profile.linkedin ?? ""}
            />
          </Field>
          <Field label="GitHub" hint="Org or profile URL.">
            <TextInput
              name="github"
              type="url"
              maxLength={512}
              placeholder="https://github.com/dsec-hub"
              defaultValue={profile.github ?? ""}
            />
          </Field>
          <Field label="Email" hint="Public contact address (shown as a mailto).">
            <TextInput
              name="email"
              type="email"
              maxLength={254}
              placeholder="admin@dsec.club"
              defaultValue={profile.email ?? ""}
            />
          </Field>
        </div>
      </fieldset>

      {canWrite && <SubmitButton>Save profile</SubmitButton>}
    </form>
  );
}
