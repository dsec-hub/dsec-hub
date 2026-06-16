"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { Field, FormError, TextArea, TextInput } from "@/components/form";
import { SubmitButton } from "@/components/submit-button";
import { buttonSecondary } from "@/components/ui";
import { cn } from "@/lib/format";
import { ASSIGNABLE_MODULES, levelFor, type AccessLevel } from "@/lib/rbac";
import { useUndoToast } from "@/lib/use-undo-toast";
import type { RoleRow } from "@/lib/admin-queries";
import type { FormState } from "./actions";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

export function RoleForm({
  action,
  role,
  onSuccess,
  onCancel,
  redirectOnSuccess,
}: {
  action: Action;
  role?: RoleRow;
  onSuccess?: () => void;
  onCancel?: () => void;
  redirectOnSuccess?: string;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(action, undefined);
  useUndoToast(state);

  useEffect(() => {
    if (!state?.ok) return;
    if (onSuccess) onSuccess();
    else if (redirectOnSuccess) router.push(redirectOnSuccess);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const locked = role?.isSystem ?? false;

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      <FormError>{state?.error}</FormError>

      <Field label="Role name" hint={locked ? "System role — name is locked." : undefined}>
        <TextInput name="name" required defaultValue={role?.name ?? ""} disabled={locked} />
      </Field>

      <Field label="Description">
        <TextArea
          name="description"
          defaultValue={role?.description ?? ""}
          placeholder="What is this role for?"
        />
      </Field>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <div className="text-sm text-muted">Module access</div>
          <div className="text-xs text-muted/60">None · View · Edit</div>
        </div>
        <div className="divide-y divide-border rounded-lg border border-border bg-surface px-4">
          {ASSIGNABLE_MODULES.map((m) => (
            <AccessControl
              key={m.key}
              moduleKey={m.key}
              label={m.label}
              description={m.description}
              initial={role ? levelFor(role.modules, role.writeModules, m.key) : "none"}
              locked={locked}
              twoState={m.key === "admin"}
            />
          ))}
        </div>
        <p className="text-xs text-muted/70">
          {locked
            ? "The Admin role always has full access and cannot be changed."
            : "View = read-only access. Edit = can also create, change, and delete."}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton>{role ? "Save changes" : "Create role"}</SubmitButton>
        {onCancel ? (
          <button type="button" onClick={onCancel} className={buttonSecondary}>
            Cancel
          </button>
        ) : (
          <Link href="/admin/roles" className={buttonSecondary}>
            Cancel
          </Link>
        )}
      </div>
    </form>
  );
}

const ACCESS_OPTIONS: { value: AccessLevel; label: string }[] = [
  { value: "none", label: "None" },
  { value: "read", label: "View" },
  { value: "write", label: "Edit" },
];
// "admin" is a superuser flag, not a readable section — offer None / Full only.
const ACCESS_OPTIONS_BINARY: { value: AccessLevel; label: string }[] = [
  { value: "none", label: "None" },
  { value: "write", label: "Full" },
];

/** A per-module segmented control. Submits its level via a hidden
 * `access:<module>` field that `parseRole` (actions.ts) decodes. */
function AccessControl({
  moduleKey,
  label,
  description,
  initial,
  locked,
  twoState,
}: {
  moduleKey: string;
  label: string;
  description: string;
  initial: AccessLevel;
  locked: boolean;
  twoState?: boolean;
}) {
  const [value, setValue] = useState<AccessLevel>(initial);
  const options = twoState ? ACCESS_OPTIONS_BINARY : ACCESS_OPTIONS;
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <p className="mt-0.5 text-xs text-muted/70">{description}</p>
      </div>
      <input type="hidden" name={`access:${moduleKey}`} value={value} />
      <div className="flex shrink-0 overflow-hidden rounded-md border border-border">
        {options.map((o, i) => {
          const active = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              disabled={locked}
              aria-pressed={active}
              onClick={() => setValue(o.value)}
              className={cn(
                "px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed",
                i > 0 && "border-l border-border",
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted hover:bg-elevated hover:text-foreground",
                locked && !active && "opacity-40",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
