"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { CheckboxField, Field, FormError, SelectField, TextInput } from "@/components/form";
import { SubmitButton } from "@/components/submit-button";
import { buttonSecondary } from "@/components/ui";
import { useUndoToast } from "@/lib/use-undo-toast";
import type { UserRow } from "@/lib/admin-queries";
import type { FormState } from "./actions";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

export function UserForm({
  action,
  user,
  roles,
  isSelf,
  redirectOnSuccess,
}: {
  action: Action;
  user: UserRow;
  roles: { id: number; name: string }[];
  isSelf: boolean;
  redirectOnSuccess?: string;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(action, undefined);
  useUndoToast(state);

  useEffect(() => {
    if (state?.ok && redirectOnSuccess) router.push(redirectOnSuccess);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      <FormError>{state?.error}</FormError>

      <Field label="Email">
        <TextInput value={user.email} disabled readOnly />
      </Field>

      <Field label="Name">
        <TextInput name="name" defaultValue={user.name ?? ""} />
      </Field>

      <Field label="Role" hint="Controls which modules this person can access.">
        <SelectField name="role_id" defaultValue={user.roleId ?? ""} required>
          <option value="" disabled>
            Choose a role…
          </option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </SelectField>
      </Field>

      <Field
        label="Reset password"
        hint="Optional — leave blank to keep the current password."
      >
        <TextInput
          type="password"
          name="password"
          autoComplete="new-password"
          placeholder="New password (min 12 chars)"
        />
      </Field>

      {isSelf ? (
        // A disabled checkbox wouldn't submit, so post the value via a hidden
        // field and show a read-only checkbox for clarity.
        <>
          <input type="hidden" name="is_active" value="on" />
          <CheckboxField
            label="Active (you can't disable your own account)"
            checked
            disabled
            readOnly
          />
        </>
      ) : (
        <CheckboxField
          label="Active — can sign in"
          name="is_active"
          defaultChecked={user.isActive}
        />
      )}

      <div className="flex items-center gap-3">
        <SubmitButton>Save changes</SubmitButton>
        <Link href="/admin/users" className={buttonSecondary}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
