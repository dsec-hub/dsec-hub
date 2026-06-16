"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { Field, FormError, SelectField, TextArea, TextInput } from "@/components/form";
import { CommitteeSelect } from "@/components/committee-select";
import { DateField } from "@/components/date-field";
import { SubmitButton } from "@/components/submit-button";
import { buttonSecondary } from "@/components/ui";
import { useUndoToast } from "@/lib/use-undo-toast";
import { TASK_PRIORITIES } from "@/lib/workspace-options";
import type { tasks } from "@/db/workspace-schema";
import type { FormState } from "./actions";

type TaskRow = typeof tasks.$inferSelect;
type Option = { id: number; name: string };
type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

export function TaskForm({
  action,
  task,
  boards,
  people,
  events,
  projects,
  committees,
  onSuccess,
  onCancel,
  redirectOnSuccess,
  canWrite = true,
}: {
  action: Action;
  task?: TaskRow;
  boards: Option[];
  people: Option[];
  events: Option[];
  projects: Option[];
  committees: Option[];
  onSuccess?: () => void;
  onCancel?: () => void;
  redirectOnSuccess?: string;
  canWrite?: boolean;
}) {
  const [state, formAction] = useActionState(action, undefined);
  useUndoToast(state);
  const router = useRouter();
  const t = task;

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

        <Field label="Title">
          <TextInput name="title" required defaultValue={t?.title ?? ""} />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Board">
            <SelectField name="board_id" defaultValue={t?.boardId ? String(t.boardId) : ""}>
              <option value="">Inbox (no board)</option>
              {boards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </SelectField>
          </Field>
          <Field label="Status">
            <TextInput name="status" defaultValue={t?.status ?? "Backlog"} />
          </Field>
          <Field label="Priority">
            <SelectField name="priority" defaultValue={t?.priority ?? ""}>
              <option value="">—</option>
              {TASK_PRIORITIES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </SelectField>
          </Field>
          <Field label="Assignee">
            <SelectField
              name="assignee_id"
              defaultValue={t?.assigneeId ? String(t.assigneeId) : ""}
            >
              <option value="">—</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </SelectField>
          </Field>
          <Field label="Committee">
            <CommitteeSelect committees={committees} defaultValue={t?.committee} />
          </Field>
          <Field label="Due date">
            <DateField name="due_date" defaultValue={t?.dueDate ?? ""} />
          </Field>
          <Field label="Related event">
            <SelectField
              name="related_event_id"
              defaultValue={t?.relatedEventId ? String(t.relatedEventId) : ""}
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
              defaultValue={t?.relatedProjectId ? String(t.relatedProjectId) : ""}
            >
              <option value="">—</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </SelectField>
          </Field>
        </div>

        <Field label="Description">
          <TextArea name="description" defaultValue={t?.description ?? ""} />
        </Field>
      </fieldset>

      <div className="flex items-center gap-3">
        {canWrite ? (
          <SubmitButton>{task ? "Save changes" : "Add task"}</SubmitButton>
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
