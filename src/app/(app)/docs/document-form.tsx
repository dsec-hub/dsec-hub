"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";

import { Field, FormError, SelectField, TextInput } from "@/components/form";
import { MarkdownEditor } from "@/components/markdown-editor";
import { SubmitButton } from "@/components/submit-button";
import { buttonSecondary } from "@/components/ui";
import { useActionToast } from "@/lib/use-action-toast";
import { DOC_STATUSES, DOC_TYPES } from "@/lib/workspace-options";
import type { Option } from "@/lib/workspace-queries";
import type { DocumentRow, FormState } from "./actions";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

export function DocumentForm({
  action,
  document,
  people,
  events,
  projects,
  meetings,
  tasks,
  committees,
  canChooseCommittee,
  lockedCommittee,
  onSuccess,
  onCancel,
  canWrite = true,
}: {
  action: Action;
  document?: DocumentRow;
  people: Option[];
  events: Option[];
  projects: Option[];
  meetings: Option[];
  tasks: Option[];
  /** Committee names for the visibility picker (only used when canChooseCommittee). */
  committees: string[];
  /** "all"-scope users pick any committee/club-wide; "own"-scope users are locked. */
  canChooseCommittee: boolean;
  /** The own-scope user's committee — the doc is forced to this. */
  lockedCommittee: string | null;
  onSuccess?: () => void;
  onCancel?: () => void;
  canWrite?: boolean;
}) {
  const [state, formAction] = useActionState(action, undefined);
  useActionToast(state);
  const d = document;

  useEffect(() => {
    if (state?.ok) onSuccess?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="space-y-6">
      <fieldset disabled={!canWrite} className="space-y-6">
        <FormError>{state?.error}</FormError>

        <Field label="Title">
          <TextInput name="title" required defaultValue={d?.title ?? ""} />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Type">
            <SelectField name="type" defaultValue={d?.type ?? "Note"}>
              {DOC_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </SelectField>
          </Field>
          <Field label="Status">
            <SelectField name="status" defaultValue={d?.status ?? "Draft"}>
              {DOC_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </SelectField>
          </Field>
          {canChooseCommittee ? (
            <Field label="Visible to" hint="Club-wide = everyone with Docs access.">
              <SelectField name="committee" defaultValue={d?.committee ?? ""}>
                <option value="">Club-wide (all committees)</option>
                {committees.map((c) => (
                  <option key={c} value={c}>
                    {c} only
                  </option>
                ))}
              </SelectField>
            </Field>
          ) : (
            <Field label="Visible to" hint="Your committee + execs.">
              <input type="hidden" name="committee" value={lockedCommittee ?? ""} />
              <TextInput value={lockedCommittee ?? "Your committee"} disabled readOnly />
            </Field>
          )}
          <Field label="Assignee" hint="For deliverable docs">
            <SelectField
              name="assignee_id"
              defaultValue={d?.assigneeId ? String(d.assigneeId) : ""}
            >
              <option value="">—</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </SelectField>
          </Field>
          <Field label="Related event">
            <SelectField
              name="related_event_id"
              defaultValue={d?.relatedEventId ? String(d.relatedEventId) : ""}
            >
              <option value="">—</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </SelectField>
          </Field>
          <Field label="Related project">
            <SelectField
              name="related_project_id"
              defaultValue={d?.relatedProjectId ? String(d.relatedProjectId) : ""}
            >
              <option value="">—</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </SelectField>
          </Field>
          <Field label="Related meeting">
            <SelectField
              name="related_meeting_id"
              defaultValue={d?.relatedMeetingId ? String(d.relatedMeetingId) : ""}
            >
              <option value="">—</option>
              {meetings.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </SelectField>
          </Field>
          <Field label="Related task" hint="Attach this doc to a task">
            <SelectField
              name="related_task_id"
              defaultValue={d?.relatedTaskId ? String(d.relatedTaskId) : ""}
            >
              <option value="">—</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </SelectField>
          </Field>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <label htmlFor="doc-content" className="text-sm text-muted">
              Content
            </label>
            <span className="hidden text-xs text-muted/70 sm:block">
              Formats as you type — # heading, - list, **bold**, `code`
            </span>
          </div>
          <MarkdownEditor
            id="doc-content"
            name="content"
            defaultValue={d?.content ?? ""}
            placeholder="Write… it formats as you type"
            canWrite={canWrite}
          />
        </div>
      </fieldset>

      <div className="flex items-center gap-3">
        {canWrite ? (
          <SubmitButton>{document ? "Save changes" : "Create document"}</SubmitButton>
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
          <Link href="/docs" className={buttonSecondary}>
            Cancel
          </Link>
        )}
      </div>
    </form>
  );
}
