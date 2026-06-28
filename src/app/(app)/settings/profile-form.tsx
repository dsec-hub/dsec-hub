"use client";

import { useActionState } from "react";

import { CheckboxField, Field, FormError, TextArea, TextInput } from "@/components/form";
import { SubmitButton } from "@/components/submit-button";
import { useActionToast } from "@/lib/use-action-toast";
import type { PersonRow } from "@/lib/queries";
import { updateProfile } from "./actions";

export function ProfileForm({ person }: { person: PersonRow }) {
  const [state, formAction] = useActionState(updateProfile, undefined);
  useActionToast(state);
  const p = person;

  return (
    <form action={formAction} className="space-y-6">
      <FormError>{state?.error}</FormError>

      <fieldset className="rounded-xl border border-border p-4">
        <legend className="px-1 text-xs text-muted">Account</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Full name">
            <TextInput name="name" required defaultValue={p.name ?? ""} autoComplete="name" />
          </Field>
          <Field label="Student ID">
            <TextInput
              name="student_id"
              defaultValue={p.studentId ?? ""}
              placeholder="Links your DUSA membership"
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="rounded-xl border border-border p-4">
        <legend className="px-1 text-xs text-muted">Links</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Website / portfolio">
            <TextInput name="website" defaultValue={p.website ?? ""} placeholder="https://…" />
          </Field>
          <Field label="Discord">
            <TextInput name="discord" defaultValue={p.discord ?? ""} placeholder="username" />
          </Field>
          <Field label="Instagram">
            <TextInput name="instagram" defaultValue={p.instagram ?? ""} placeholder="@handle" />
          </Field>
          <Field label="GitHub">
            <TextInput name="github" defaultValue={p.github ?? ""} placeholder="username" />
          </Field>
          <Field label="LinkedIn">
            <TextInput name="linkedin" defaultValue={p.linkedin ?? ""} placeholder="profile URL" />
          </Field>
        </div>
      </fieldset>

      <fieldset className="rounded-xl border border-border p-4">
        <legend className="px-1 text-xs text-muted">Public profile</legend>
        <div className="space-y-5">
          <Field
            label="Bio"
            hint="A public one-line intro shown under your name on the website team grid. Separate from your internal Notes below."
          >
            <TextArea
              name="bio"
              defaultValue={p.bio ?? ""}
              placeholder="e.g. Leads web projects and runs React/Next.js workshops."
            />
          </Field>
          <div className="space-y-1">
            <CheckboxField
              label="Show my profile on the public website"
              name="show_on_website"
              defaultChecked={p.showOnWebsite ?? false}
            />
            <p className="pl-[26px] text-xs text-muted">
              Publishes you on the public team grid at dsec.club. Add a profile photo and a
              bio above for the best look. Leave unchecked to stay private.
            </p>
          </div>
        </div>
      </fieldset>

      <Field label="Notes" hint="Internal — never shown on the public site.">
        <TextArea name="notes" defaultValue={p.notes ?? ""} />
      </Field>

      <SubmitButton>Save changes</SubmitButton>
    </form>
  );
}
