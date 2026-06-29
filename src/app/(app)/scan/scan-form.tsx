"use client";

import { useActionState, useEffect, useState } from "react";

import { CheckboxField, Field, FormError, SelectField, TextInput } from "@/components/form";
import { SubmitButton } from "@/components/submit-button";
import { buttonSecondary } from "@/components/ui";
import { cn } from "@/lib/format";
import { SCAN_ACCENTS, SCAN_ACCENT_SWATCH } from "@/lib/options";
import { useUndoToast } from "@/lib/use-undo-toast";
import type { ScanTargetRow } from "@/lib/workspace-queries";

import type { FormState } from "./actions";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

export function ScanForm({
  action,
  target,
  onSuccess,
  onCancel,
  canWrite = true,
}: {
  action: Action;
  target?: ScanTargetRow;
  onSuccess?: (result: FormState) => void;
  onCancel?: () => void;
  canWrite?: boolean;
}) {
  const [state, formAction] = useActionState(action, undefined);
  useUndoToast(state);
  const [accent, setAccent] = useState(target?.accent ?? "");

  useEffect(() => {
    if (state?.ok && onSuccess) onSuccess(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      <fieldset disabled={!canWrite} className="space-y-6">
        <FormError>{state?.error}</FormError>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Label" hint="The card heading, e.g. “Website”.">
            <TextInput name="label" required maxLength={120} defaultValue={target?.label ?? ""} />
          </Field>
          <Field label="Pretty text" hint="Short display under the QR, e.g. “@dsec” or “dsec.club”.">
            <TextInput name="pretty" maxLength={120} defaultValue={target?.pretty ?? ""} />
          </Field>
        </div>

        <Field label="Caption" hint="One descriptive line, e.g. “Photos from every event”.">
          <TextInput name="caption" maxLength={200} defaultValue={target?.caption ?? ""} />
        </Field>

        <Field label="URL" hint="An absolute link the QR encodes (https://…, mailto: or tel:).">
          <TextInput
            name="url"
            required
            maxLength={2048}
            placeholder="https://…"
            defaultValue={target?.url ?? ""}
          />
        </Field>

        <Field label="Accent" hint="Card header colour. “Auto” cycles brand colours by position.">
          <div className="space-y-2">
            <SelectField name="accent" value={accent} onChange={(e) => setAccent(e.target.value)}>
              <option value="">Auto (cycle)</option>
              {SCAN_ACCENTS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </SelectField>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setAccent("")}
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs transition-colors",
                  accent === "" ? "border-accent ring-1 ring-accent" : "border-border hover:bg-elevated",
                )}
              >
                <span className="size-3.5 rounded-full bg-gradient-to-br from-pink-400 via-yellow-300 to-sky-400" />
                Auto
              </button>
              {SCAN_ACCENTS.map((a) => (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => setAccent(a.value)}
                  title={a.label}
                  aria-label={a.label}
                  className={cn(
                    "flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs transition-colors",
                    accent === a.value ? "border-accent ring-1 ring-accent" : "border-border hover:bg-elevated",
                  )}
                >
                  <span
                    className="size-3.5 rounded-full"
                    style={{ backgroundColor: SCAN_ACCENT_SWATCH[a.value] }}
                  />
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </Field>

        <CheckboxField
          label="Visible on the public /scan page"
          name="is_visible"
          defaultChecked={target?.isVisible ?? true}
        />
      </fieldset>

      <div className="flex items-center gap-3">
        {canWrite ? (
          <SubmitButton>{target ? "Save changes" : "Add card"}</SubmitButton>
        ) : (
          <p className="text-sm text-muted">View only — you don’t have edit access for this section.</p>
        )}
        {onCancel && (
          <button type="button" onClick={onCancel} className={buttonSecondary}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
