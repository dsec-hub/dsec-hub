"use client";

import { useActionState } from "react";

import { Field, FormError, TextArea, TextInput } from "@/components/form";
import { SubmitButton } from "@/components/submit-button";
import { useUndoToast } from "@/lib/use-undo-toast";

import { saveScanPage } from "./actions";

type ScanPageLike = {
  title: string | null;
  description: string | null;
};

// The built-in copy shown on /scan when a field is left blank — surfaced as the
// placeholder so the committee sees what the default looks like. KEEP in sync
// with dsec-api scan service DEFAULT_PAGE_* and dsec-website's DEFAULT_SCAN_PAGE.
const DEFAULT_TITLE = "Point your camera. You're in.";
const DEFAULT_DESCRIPTION =
  "Scan a code below to connect with DSEC. No app to install, just your phone.";

export function ScanPageForm({
  page,
  canWrite = true,
}: {
  page: ScanPageLike;
  canWrite?: boolean;
}) {
  const [state, formAction] = useActionState(saveScanPage, undefined);
  useUndoToast(state);

  return (
    <form action={formAction} className="space-y-5">
      <fieldset disabled={!canWrite} className="space-y-5">
        <FormError>{state?.error}</FormError>

        <Field
          label="Title"
          hint="The big heading on the /scan screen. Leave blank to use the default."
        >
          <TextInput
            name="title"
            maxLength={120}
            placeholder={DEFAULT_TITLE}
            defaultValue={page.title ?? ""}
          />
        </Field>

        <Field
          label="Description"
          hint="The line under the title. Leave blank to use the default."
        >
          <TextArea
            name="description"
            rows={2}
            maxLength={300}
            placeholder={DEFAULT_DESCRIPTION}
            defaultValue={page.description ?? ""}
          />
        </Field>
      </fieldset>

      {canWrite && <SubmitButton>Save heading</SubmitButton>}
    </form>
  );
}
