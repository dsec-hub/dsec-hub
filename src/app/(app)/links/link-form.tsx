"use client";

import { useActionState, useEffect, useState } from "react";

import { CheckboxField, Field, FormError, SelectField, TextInput } from "@/components/form";
import { SubmitButton } from "@/components/submit-button";
import { buttonSecondary } from "@/components/ui";
import { cn } from "@/lib/format";
import { LINK_ACCENTS, LINK_ACCENT_SWATCH } from "@/lib/options";
import { useUndoToast } from "@/lib/use-undo-toast";
import type { LinkRow } from "@/lib/workspace-queries";

import type { FormState } from "./actions";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

// A few on-brand emoji to one-click into the icon field. Free typing still works.
const EMOJI_SUGGESTIONS = ["🎮", "💬", "📸", "🌐", "🎟️", "🏆", "📅", "🤝", "✨", "📣", "🎓", "🔗"];

export function LinkForm({
  action,
  link,
  onSuccess,
  onCancel,
  canWrite = true,
}: {
  action: Action;
  link?: LinkRow;
  onSuccess?: (result: FormState) => void;
  onCancel?: () => void;
  canWrite?: boolean;
}) {
  const [state, formAction] = useActionState(action, undefined);
  useUndoToast(state);
  const [icon, setIcon] = useState(link?.icon ?? "");
  const [accent, setAccent] = useState(link?.accent ?? "");

  useEffect(() => {
    if (state?.ok && onSuccess) onSuccess(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      <fieldset disabled={!canWrite} className="space-y-6">
        <FormError>{state?.error}</FormError>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Title" hint="The button label, e.g. “Join the Discord”.">
            <TextInput name="title" required maxLength={120} defaultValue={link?.title ?? ""} />
          </Field>
          <Field label="Subtitle" hint="Optional 2nd line, e.g. “500+ members”.">
            <TextInput name="subtitle" maxLength={160} defaultValue={link?.subtitle ?? ""} />
          </Field>
        </div>

        <Field label="URL" hint="A full link (https://…) or a site path like /events.">
          <TextInput
            name="url"
            required
            maxLength={2048}
            placeholder="https://…"
            defaultValue={link?.url ?? ""}
          />
        </Field>

        <Field label="Icon" hint="A single emoji shown on the button (optional).">
          <div className="space-y-2">
            <TextInput
              name="icon"
              maxLength={32}
              placeholder="🎮"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              className="w-24 text-center text-lg"
            />
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_SUGGESTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setIcon(e)}
                  className="grid size-8 place-items-center rounded-md border border-border bg-surface text-base transition-colors hover:bg-elevated"
                  aria-label={`Use ${e}`}
                >
                  {e}
                </button>
              ))}
              {icon && (
                <button
                  type="button"
                  onClick={() => setIcon("")}
                  className="grid size-8 place-items-center rounded-md border border-border bg-surface text-xs text-muted transition-colors hover:bg-elevated"
                  aria-label="Clear icon"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </Field>

        <Field label="Accent" hint="Colour for the button. “Auto” cycles brand colours by position.">
          <div className="space-y-2">
            <SelectField
              name="accent"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
            >
              <option value="">Auto (cycle)</option>
              {LINK_ACCENTS.map((a) => (
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
              {LINK_ACCENTS.map((a) => (
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
                    style={{ backgroundColor: LINK_ACCENT_SWATCH[a.value] }}
                  />
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </Field>

        <CheckboxField
          label="Visible on the public page"
          name="is_visible"
          defaultChecked={link?.isVisible ?? true}
        />
      </fieldset>

      <div className="flex items-center gap-3">
        {canWrite ? (
          <SubmitButton>{link ? "Save changes" : "Add link"}</SubmitButton>
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
