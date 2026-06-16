"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { CommitteeSelect } from "@/components/committee-select";
import { Field, FormError, TextArea, TextInput } from "@/components/form";
import { SubmitButton } from "@/components/submit-button";
import { buttonSecondary } from "@/components/ui";
import { useUndoToast } from "@/lib/use-undo-toast";
import type { FormState } from "./actions";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

export function BoardForm({
  action,
  committees,
  onSuccess,
  onCancel,
  redirectOnSuccess,
  canWrite = true,
}: {
  action: Action;
  committees: { id: number; name: string }[];
  onSuccess?: () => void;
  onCancel?: () => void;
  redirectOnSuccess?: string;
  canWrite?: boolean;
}) {
  const [state, formAction] = useActionState(action, undefined);
  useUndoToast(state);
  const router = useRouter();

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

        <Field label="Name">
          <TextInput name="name" required placeholder="e.g. Events board" />
        </Field>

        <Field label="Committee">
          <CommitteeSelect committees={committees} />
        </Field>

        <Field label="Description" hint="Columns default to Backlog · To Do · In Progress · Done.">
          <TextArea name="description" />
        </Field>
      </fieldset>

      <div className="flex items-center gap-3">
        {canWrite ? (
          <SubmitButton>Create board</SubmitButton>
        ) : (
          <p className="text-sm text-muted">
            View only — you don’t have edit access for this section.
          </p>
        )}
        {onCancel ? (
          <button type="button" onClick={onCancel} className={buttonSecondary}>
            Cancel
          </button>
        ) : (
          <Link href="/tasks" className={buttonSecondary}>
            Cancel
          </Link>
        )}
      </div>
    </form>
  );
}
