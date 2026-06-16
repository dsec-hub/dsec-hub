"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { CommitteeSelect } from "@/components/committee-select";
import { CheckboxField, Field, FormError, SelectField, TextArea, TextInput } from "@/components/form";
import { SubmitButton } from "@/components/submit-button";
import { buttonSecondary } from "@/components/ui";
import { PERSON_STATUSES, PERSON_TYPES } from "@/lib/options";
import { useUndoToast } from "@/lib/use-undo-toast";
import type { FormState } from "./actions";
import type { PersonRow } from "@/lib/queries";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

export function PersonForm({
  action,
  person,
  committees,
  canWrite = true,
  isAdmin = false,
  onSuccess,
  onCancel,
  redirectOnSuccess,
}: {
  action: Action;
  person?: PersonRow;
  committees: { id: number; name: string }[];
  canWrite?: boolean;
  /** Only admins may toggle internal (admin-only) visibility. */
  isAdmin?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
  redirectOnSuccess?: string;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(action, undefined);
  useUndoToast(state);
  const p = person;

  useEffect(() => {
    if (!state?.ok) return;
    if (onSuccess) onSuccess();
    else if (redirectOnSuccess) router.push(redirectOnSuccess);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      <fieldset disabled={!canWrite} className="space-y-6">
        <FormError>{state?.error}</FormError>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Name">
            <TextInput name="name" required defaultValue={p?.name ?? ""} />
          </Field>
          <Field label="Email">
            <TextInput type="email" name="email" defaultValue={p?.email ?? ""} />
          </Field>
          <Field label="Type">
            <SelectField name="type" defaultValue={p?.type ?? "Committee Member"}>
              {PERSON_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </SelectField>
          </Field>
          <Field label="Status">
            <SelectField name="status" defaultValue={p?.status ?? "Active"}>
              {PERSON_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </SelectField>
          </Field>
          <Field label="Committee">
            <CommitteeSelect committees={committees} defaultValue={p?.committee} />
          </Field>
          <Field label="Role title">
            <TextInput
              name="role_title"
              defaultValue={p?.roleTitle ?? ""}
              placeholder="e.g. Events Lead"
            />
          </Field>
          <Field label="Student ID">
            <TextInput
              name="student_id"
              defaultValue={p?.studentId ?? ""}
              placeholder="Links DUSA membership"
            />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Website / portfolio">
            <TextInput name="website" defaultValue={p?.website ?? ""} placeholder="https://…" />
          </Field>
          <Field label="Discord">
            <TextInput name="discord" defaultValue={p?.discord ?? ""} placeholder="username" />
          </Field>
          <Field label="Instagram">
            <TextInput name="instagram" defaultValue={p?.instagram ?? ""} placeholder="@handle" />
          </Field>
          <Field label="GitHub">
            <TextInput name="github" defaultValue={p?.github ?? ""} placeholder="username" />
          </Field>
          <Field label="LinkedIn">
            <TextInput name="linkedin" defaultValue={p?.linkedin ?? ""} placeholder="profile URL" />
          </Field>
        </div>

        {/* Public website profile — only what the public site shows. */}
        <div className="space-y-5 border-t border-border pt-6">
          <Field
            label="Bio"
            hint="Public one-line intro shown under their name on the website team grid. Kept separate from internal Notes."
          >
            <TextArea
              name="bio"
              defaultValue={p?.bio ?? ""}
              placeholder="e.g. Leads web projects and runs React/Next.js workshops."
            />
          </Field>
          <div className="grid items-start gap-5 sm:grid-cols-2">
            <div className="space-y-1">
              <CheckboxField
                label="Show on website"
                name="show_on_website"
                defaultChecked={p?.showOnWebsite ?? false}
              />
              <p className="pl-[26px] text-xs text-muted">
                Publishes this person on the public team/committee grid. Upload a profile
                photo below for the best look.
              </p>
            </div>
            <Field label="Display order" hint="Lower numbers appear first on the website grid.">
              <TextInput
                type="number"
                name="display_order"
                defaultValue={p?.displayOrder ?? 0}
              />
            </Field>
          </div>
        </div>

        <Field label="Notes" hint="Internal — never shown on the public site.">
          <TextArea name="notes" defaultValue={p?.notes ?? ""} />
        </Field>

        {/* Admin-only: hide this person from non-admin committee members. */}
        {isAdmin && (
          <div className="space-y-1 border-t border-border pt-6">
            <CheckboxField
              label="Hidden from non-admins"
              name="admin_only"
              defaultChecked={p?.adminOnly ?? false}
            />
            <p className="pl-[26px] text-xs text-muted">
              Only admins will see this person on the People page. Use for sensitive
              contacts the wider committee shouldn’t see.
            </p>
          </div>
        )}
      </fieldset>

      <div className="flex items-center gap-3">
        {canWrite ? (
          <SubmitButton>{person ? "Save changes" : "Add person"}</SubmitButton>
        ) : (
          <p className="text-sm text-muted">View only — you don’t have edit access for this section.</p>
        )}
        {onCancel ? (
          <button type="button" onClick={onCancel} className={buttonSecondary}>
            Cancel
          </button>
        ) : (
          <Link href="/people" className={buttonSecondary}>
            Cancel
          </Link>
        )}
      </div>
    </form>
  );
}
