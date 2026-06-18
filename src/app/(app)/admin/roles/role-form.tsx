"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";

import { CheckboxField, Field, FormError, SelectField, TextArea, TextInput } from "@/components/form";
import { SubmitButton } from "@/components/submit-button";
import { buttonSecondary } from "@/components/ui";
import { cn } from "@/lib/format";
import { ASSIGNABLE_MODULES, MODULES, MODULE_KEYS, levelFor, type AccessLevel } from "@/lib/rbac";
import { CANONICAL_SECTIONS, normalizeViewConfig } from "@/lib/dashboard-config";
import { BUILT_IN_VIEW_KEYS, type BuiltInViewKey } from "@/lib/task-view-types";
import { useUndoToast } from "@/lib/use-undo-toast";
import type { RoleRow } from "@/lib/admin-queries";
import type { FormState } from "./actions";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

const VIEW_LABELS: Record<BuiltInViewKey, string> = {
  "my-work": "My Work",
  "all-tasks": "All Tasks",
  "by-committee": "By Committee",
  "by-event": "By Event / Project",
  "by-board": "Boards",
};

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

  // Lift module-access state so the Focus controls below can react to it (only
  // offer landing pages / dashboard sections the role can actually access).
  const [levels, setLevels] = useState<Record<string, AccessLevel>>(() =>
    Object.fromEntries(
      MODULE_KEYS.map((k) => [k, role ? levelFor(role.modules, role.writeModules, k) : "none"]),
    ),
  );

  const vcfg = useMemo(() => normalizeViewConfig(role?.viewConfig ?? null, role?.name), [role]);
  const [landing, setLanding] = useState(vcfg.landingPath ?? "/dashboard");
  const [defaultView, setDefaultView] = useState(vcfg.defaultTaskView ?? "my-work");
  const [sections, setSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CANONICAL_SECTIONS.map((s) => [s.id, !!vcfg.sections?.[s.id]])),
  );

  const adminGranted = levels["admin"] === "write";
  const moduleAccessible = (key: string) =>
    adminGranted || levels[key] === "read" || levels[key] === "write";

  const landingOptions = useMemo(() => {
    const opts = [{ label: "Dashboard", value: "/dashboard" }];
    for (const m of MODULES) {
      if (moduleAccessible(m.key)) opts.push({ label: m.label, value: m.href });
    }
    return opts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levels]);
  const landingValue = landingOptions.some((o) => o.value === landing) ? landing : "/dashboard";

  const tasksAccessible = moduleAccessible("tasks");

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
              value={levels[m.key] ?? "none"}
              onChange={(v) => setLevels((prev) => ({ ...prev, [m.key]: v }))}
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

      {/* --- Focus & dashboard (the presentation/Focus layer) ----------------- */}
      <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <div>
          <div className="text-sm font-medium">Focus &amp; dashboard</div>
          <p className="mt-0.5 text-xs text-muted/70">
            Controls what this role sees first — never grants access beyond the
            toggles above. Options follow the modules you grant.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Lands on" hint="Where this role goes after signing in.">
            <SelectField
              name="viewConfig:landing"
              value={landingValue}
              onChange={(e) => setLanding(e.target.value)}
            >
              {landingOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </SelectField>
          </Field>

          <Field
            label="Default task view"
            hint={tasksAccessible ? undefined : "Grant the Tasks module to use this."}
          >
            <SelectField
              name="viewConfig:defaultView"
              value={defaultView}
              onChange={(e) => setDefaultView(e.target.value)}
            >
              {BUILT_IN_VIEW_KEYS.map((k) => (
                <option key={k} value={k}>
                  {VIEW_LABELS[k]}
                </option>
              ))}
            </SelectField>
          </Field>
        </div>

        <div>
          <div className="mb-1.5 text-xs text-muted">Dashboard sections</div>
          <div className="grid gap-2 rounded-lg border border-border bg-background px-4 py-3 sm:grid-cols-2">
            {CANONICAL_SECTIONS.map((s) => {
              const accessible = moduleAccessible(s.module);
              return (
                <div key={s.id} className={cn("flex flex-col gap-0.5", !accessible && "opacity-45")}>
                  <CheckboxField
                    label={s.label}
                    name={`viewConfig:section:${s.id}`}
                    checked={accessible && !!sections[s.id]}
                    disabled={!accessible}
                    onChange={(e) =>
                      setSections((prev) => ({ ...prev, [s.id]: e.target.checked }))
                    }
                  />
                  <span className="pl-[26px] text-[11px] leading-snug text-muted/60">
                    {accessible ? s.description : `Needs the ${moduleLabel(s.module)} module`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
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

function moduleLabel(key: string): string {
  return MODULES.find((m) => m.key === key)?.label ?? key;
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

/** A per-module segmented control. Controlled by the parent so the Focus
 * controls can react to access. Submits its level via a hidden `access:<module>`
 * field that `parseRole` (actions.ts) decodes. */
function AccessControl({
  moduleKey,
  label,
  description,
  value,
  onChange,
  locked,
  twoState,
}: {
  moduleKey: string;
  label: string;
  description: string;
  value: AccessLevel;
  onChange: (v: AccessLevel) => void;
  locked: boolean;
  twoState?: boolean;
}) {
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
              onClick={() => onChange(o.value)}
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
