"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import {
  CheckboxField,
  Field,
  FormError,
  SelectField,
  TextArea,
  TextInput,
} from "@/components/form";
import { SubmitButton } from "@/components/submit-button";
import { buttonSecondary } from "@/components/ui";
import type { CommitteeRow } from "@/lib/committee-queries";
import { cn } from "@/lib/format";
import { useUndoToast } from "@/lib/use-undo-toast";
import type { FormState } from "./actions";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

// Curated, on-brand palette for committee dots/badges (Safari-friendly swatches
// instead of a native colour input).
const COLORS = [
  "#e91e63",
  "#f43f5e",
  "#f59e0b",
  "#eab308",
  "#10b981",
  "#14b8a6",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#64748b",
];

export function CommitteeForm({
  action,
  committee,
  people,
  onSuccess,
  onCancel,
  redirectOnSuccess,
}: {
  action: Action;
  committee?: CommitteeRow;
  people: { id: number; name: string }[];
  onSuccess?: () => void;
  onCancel?: () => void;
  redirectOnSuccess?: string;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(action, undefined);
  useUndoToast(state);
  const [color, setColor] = useState(committee?.color ?? COLORS[0]);

  useEffect(() => {
    if (!state?.ok) return;
    if (onSuccess) onSuccess();
    else if (redirectOnSuccess) router.push(redirectOnSuccess);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      <FormError>{state?.error}</FormError>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name">
          <TextInput
            name="name"
            required
            defaultValue={committee?.name ?? ""}
            placeholder="e.g. Marketing"
          />
        </Field>
        <Field label="Lead" hint="Optional — the committee's lead, from People.">
          <SelectField
            name="lead_person_id"
            defaultValue={committee?.leadPersonId ? String(committee.leadPersonId) : ""}
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

      <Field label="Colour" hint="Used for this committee's dot and badges across the app.">
        <input type="hidden" name="color" value={color} />
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => {
            const active = c.toLowerCase() === color.toLowerCase();
            return (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={c}
                aria-pressed={active}
                className={cn(
                  "size-7 rounded-full ring-2 ring-offset-2 ring-offset-background transition",
                  active ? "ring-foreground" : "ring-transparent hover:ring-border",
                )}
                style={{ backgroundColor: c }}
              />
            );
          })}
        </div>
      </Field>

      <Field label="Description">
        <TextArea
          name="description"
          defaultValue={committee?.description ?? ""}
          placeholder="What this committee is responsible for."
        />
      </Field>

      <CheckboxField
        label="Active — shown in committee pickers"
        name="is_active"
        defaultChecked={committee?.isActive ?? true}
      />

      <div className="flex items-center gap-3">
        <SubmitButton>{committee ? "Save changes" : "Create committee"}</SubmitButton>
        {onCancel ? (
          <button type="button" onClick={onCancel} className={buttonSecondary}>
            Cancel
          </button>
        ) : (
          <Link href="/admin/committees" className={buttonSecondary}>
            Cancel
          </Link>
        )}
      </div>
    </form>
  );
}
