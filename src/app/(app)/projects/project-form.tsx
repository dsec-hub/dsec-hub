"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import {
  CheckboxField,
  Field,
  FormError,
  SelectField,
  TextArea,
  TextInput,
} from "@/components/form";
import { PeopleMultiSelect } from "@/components/people-multi-select";
import { SubmitButton } from "@/components/submit-button";
import { buttonSecondary } from "@/components/ui";
import { useUndoToast } from "@/lib/use-undo-toast";
import { PROJECT_STATUSES } from "@/lib/workspace-options";
import type { Option } from "@/lib/workspace-queries";
import type { FormState, ProjectRow } from "./actions";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

export function ProjectForm({
  action,
  project,
  people,
  events,
  coOwnerIds = [],
  onSuccess,
  onCancel,
  redirectOnSuccess,
  canWrite = true,
}: {
  action: Action;
  project?: ProjectRow;
  people: Option[];
  events: Option[];
  /** Additional project owners beyond the primary lead (pre-selected on edit). */
  coOwnerIds?: number[];
  onSuccess?: (result: FormState) => void;
  onCancel?: () => void;
  redirectOnSuccess?: string;
  canWrite?: boolean;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(action, undefined);
  useUndoToast(state);
  const p = project;

  useEffect(() => {
    if (!state?.ok) return;
    if (onSuccess) onSuccess(state);
    else if (redirectOnSuccess) router.push(redirectOnSuccess);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="max-w-3xl space-y-6">
      <fieldset disabled={!canWrite} className="space-y-6">
      <FormError>{state?.error}</FormError>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name">
          <TextInput name="name" required defaultValue={p?.name ?? ""} />
        </Field>
        <Field label="Status">
          <SelectField name="status" defaultValue={p?.status ?? "Idea"}>
            {PROJECT_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </SelectField>
        </Field>
        <Field label="Category">
          <TextInput
            name="category"
            defaultValue={p?.category ?? ""}
            placeholder="e.g. Web app"
          />
        </Field>
        <Field label="Lead">
          <SelectField name="lead_id" defaultValue={p?.leadId ? String(p.leadId) : ""}>
            <option value="">—</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </SelectField>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Co-leads" hint="Extra people working on this project, beyond the lead.">
            <PeopleMultiSelect
              name="co_owner_ids"
              people={people}
              defaultSelected={coOwnerIds}
              excludeId={p?.leadId ?? null}
            />
          </Field>
        </div>
      </div>

      <Field label="Summary">
        <TextInput
          name="summary"
          defaultValue={p?.summary ?? ""}
          placeholder="One-line description"
        />
      </Field>

      <Field label="Description" hint="Shown on the public website. Markdown supported.">
        <TextArea name="description" rows={8} defaultValue={p?.description ?? ""} />
      </Field>

      <Field label="Tech tags" hint="Comma-separated, e.g. Next.js, Postgres, Drizzle">
        <TextInput
          name="tech_tags"
          defaultValue={p?.techTags?.join(", ") ?? ""}
          placeholder="Next.js, Postgres"
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Repo URL">
          <TextInput type="url" name="repo_url" defaultValue={p?.repoUrl ?? ""} />
        </Field>
        <Field label="Demo URL">
          <TextInput type="url" name="demo_url" defaultValue={p?.demoUrl ?? ""} />
        </Field>
        <Field label="Image URL">
          <TextInput type="url" name="image_url" defaultValue={p?.imageUrl ?? ""} />
        </Field>
        <Field label="Related event">
          <SelectField
            name="related_event_id"
            defaultValue={p?.relatedEventId ? String(p.relatedEventId) : ""}
          >
            <option value="">—</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
              </option>
            ))}
          </SelectField>
        </Field>
      </div>

      <div className="flex flex-wrap gap-5">
        <CheckboxField label="Featured" name="featured" defaultChecked={p?.featured ?? false} />
      </div>

      <Field label="Notes">
        <TextArea name="notes" defaultValue={p?.notes ?? ""} />
      </Field>
      </fieldset>

      <div className="flex items-center gap-3">
        {canWrite ? (
          <SubmitButton>{project ? "Save changes" : "Create project"}</SubmitButton>
        ) : (
          <p className="text-sm text-muted">
            View only — you don&apos;t have edit access for this section.
          </p>
        )}
        {onCancel ? (
          <button type="button" onClick={onCancel} className={buttonSecondary}>
            Cancel
          </button>
        ) : (
          <Link href="/projects" className={buttonSecondary}>
            Cancel
          </Link>
        )}
      </div>
    </form>
  );
}
