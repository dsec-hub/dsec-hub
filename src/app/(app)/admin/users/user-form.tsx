"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";

import { CheckboxField, Field, FormError, SelectField, TextInput } from "@/components/form";
import { SubmitButton } from "@/components/submit-button";
import { buttonSecondary } from "@/components/ui";
import { cn } from "@/lib/format";
import { ASSIGNABLE_MODULES, levelFor, type AccessLevel } from "@/lib/rbac";
import { useUndoToast } from "@/lib/use-undo-toast";
import type { UserRow } from "@/lib/admin-queries";
import type { FormState } from "./actions";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;
type RoleLite = { id: number; name: string; modules: string[]; writeModules: string[] };

// Per-user privileges cover the operational modules only — "admin" stays a
// role-only grant (keeps the last-active-admin lockout guard valid).
const OPS = ASSIGNABLE_MODULES.filter((m) => m.key !== "admin");
const RANK: Record<AccessLevel, number> = { none: 0, read: 1, write: 2 };
const maxLevel = (a: AccessLevel, b: AccessLevel): AccessLevel => (RANK[a] >= RANK[b] ? a : b);

export function UserForm({
  action,
  user,
  roles,
  isSelf,
  redirectOnSuccess,
}: {
  action: Action;
  user: UserRow;
  roles: RoleLite[];
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

  const [roleId, setRoleId] = useState<number | "">(user.roleId ?? "");
  const role = roles.find((r) => r.id === roleId);

  // The role's baseline level per module (the View/Edit it already grants).
  const baseLevel = (key: string): AccessLevel =>
    role ? levelFor(role.modules, role.writeModules, key) : "none";

  // The user's currently-saved effective level per module (baseline ∪ extras).
  const initialEffective = useMemo(() => {
    const out: Record<string, AccessLevel> = {};
    for (const m of OPS) {
      const extra: AccessLevel = user.extraWriteModules.includes(m.key)
        ? "write"
        : user.extraModules.includes(m.key)
          ? "read"
          : "none";
      out[m.key] = maxLevel(baseLevel(m.key), extra);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [levels, setLevels] = useState<Record<string, AccessLevel>>(initialEffective);

  // When the role changes, re-clamp any module below the new baseline — done at
  // render via a changed-key tracker (React's alternative to setState-in-effect).
  const [prevRoleId, setPrevRoleId] = useState(roleId);
  if (roleId !== prevRoleId) {
    setPrevRoleId(roleId);
    setLevels((prev) => {
      const next = { ...prev };
      for (const m of OPS) {
        const b = baseLevel(m.key);
        if (RANK[next[m.key]] < RANK[b]) next[m.key] = b;
      }
      return next;
    });
  }

  const anyExtra = OPS.some((m) => RANK[levels[m.key]] > RANK[baseLevel(m.key)]);

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      <FormError>{state?.error}</FormError>

      <Field label="Email">
        <TextInput value={user.email} disabled readOnly />
      </Field>

      <Field label="Name">
        <TextInput name="name" defaultValue={user.name ?? ""} />
      </Field>

      <Field label="Role" hint="The baseline access for this person. Add extras below.">
        <SelectField
          name="role_id"
          value={roleId}
          onChange={(e) => setRoleId(e.target.value ? Number(e.target.value) : "")}
          required
        >
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

      {/* Per-user custom privileges (elevate above the role; can't reduce) */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <div className="text-sm text-muted">Custom privileges</div>
          <div className="text-xs text-muted/60">None · View · Edit</div>
        </div>
        <div className="divide-y divide-border rounded-lg border border-border bg-surface px-4">
          {OPS.map((m) => (
            <ExtraControl
              key={m.key}
              label={m.label}
              description={m.description}
              base={baseLevel(m.key)}
              value={levels[m.key]}
              onChange={(v) => setLevels((prev) => ({ ...prev, [m.key]: v }))}
              moduleKey={m.key}
            />
          ))}
        </div>
        <p className="text-xs text-muted/70">
          {anyExtra
            ? "This person gets their role’s access plus the elevated modules above."
            : "Grant extra access on top of the role — e.g. give this lead the Events module without changing the role for everyone."}
        </p>
      </div>

      <Field label="Reset password" hint="Optional — leave blank to keep the current password.">
        <TextInput
          type="password"
          name="password"
          autoComplete="new-password"
          placeholder="New password (min 12 chars)"
        />
      </Field>

      {isSelf ? (
        <>
          <input type="hidden" name="is_active" value="on" />
          <CheckboxField label="Active (you can't disable your own account)" checked disabled readOnly />
        </>
      ) : (
        <CheckboxField label="Active — can sign in" name="is_active" defaultChecked={user.isActive} />
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

const LEVELS: { value: AccessLevel; label: string }[] = [
  { value: "none", label: "None" },
  { value: "read", label: "View" },
  { value: "write", label: "Edit" },
];

/** A per-module control where options below the role baseline are disabled (you
 * can only elevate). Submits the chosen effective level via `extra:<module>`. */
function ExtraControl({
  label,
  description,
  base,
  value,
  onChange,
  moduleKey,
}: {
  label: string;
  description: string;
  base: AccessLevel;
  value: AccessLevel;
  onChange: (v: AccessLevel) => void;
  moduleKey: string;
}) {
  const elevated = RANK[value] > RANK[base];
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
          {elevated && (
            <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent-text">
              elevated
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted/70">
          {base === "none" ? description : `Role grants ${base === "write" ? "Edit" : "View"}`}
        </p>
      </div>
      <input type="hidden" name={`extra:${moduleKey}`} value={value} />
      <div className="flex shrink-0 overflow-hidden rounded-md border border-border">
        {LEVELS.map((o, i) => {
          const disabled = RANK[o.value] < RANK[base]; // can't drop below the role
          const active = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => onChange(o.value)}
              className={cn(
                "px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-30",
                i > 0 && "border-l border-border",
                active ? "bg-accent text-accent-foreground" : "text-muted hover:bg-elevated hover:text-foreground",
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
