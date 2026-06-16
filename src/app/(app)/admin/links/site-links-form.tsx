"use client";

import { useActionState } from "react";

import { Field, FormError, TextInput } from "@/components/form";
import { SubmitButton } from "@/components/submit-button";
import { useUndoToast } from "@/lib/use-undo-toast";
import { SITE_LINK_FIELDS } from "@/lib/site-settings";
import { updateSiteLinks } from "./actions";

export function SiteLinksForm({ values }: { values: Record<string, string> }) {
  const [state, formAction] = useActionState(updateSiteLinks, undefined);
  useUndoToast(state);

  return (
    <form action={formAction} className="space-y-5">
      <FormError>{state?.error}</FormError>
      <fieldset className="rounded-xl border border-border p-4">
        <legend className="px-1 text-xs text-muted">Social &amp; contact</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          {SITE_LINK_FIELDS.map((f) => (
            <Field key={f.key} label={f.label}>
              <TextInput
                name={f.key}
                type={f.type === "email" ? "email" : "url"}
                defaultValue={values[f.key] ?? ""}
                placeholder={f.placeholder}
              />
            </Field>
          ))}
        </div>
      </fieldset>
      <SubmitButton>Save links</SubmitButton>
    </form>
  );
}
