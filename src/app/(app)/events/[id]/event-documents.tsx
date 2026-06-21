"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useState } from "react";

import { Field, FormError, SelectField, TextArea, TextInput } from "@/components/form";
import { Markdown } from "@/components/markdown";
import { Modal } from "@/components/modal";
import { Segmented } from "@/components/segmented";
import { SubmitButton } from "@/components/submit-button";
import { UndoButton } from "@/components/undo-button";
import { Badge, EmptyState, SectionCard, buttonGhost, buttonSecondary } from "@/components/ui";
import { cn, formatDate } from "@/lib/format";
import { useUndoToast } from "@/lib/use-undo-toast";
import { DOC_STATUSES, DOC_TYPES, docStatusVariant } from "@/lib/workspace-options";
import type { EventDocumentRow } from "@/lib/workspace-queries";

import {
  archiveEventDocument,
  createEventDocument,
  updateEventDocument,
  type FormState,
} from "../document-actions";

/** The tasks of THIS event — the pool the "Related task" picker draws from. */
type TaskOption = { id: number; title: string };

/**
 * The per-event Documents board, shown after Tasks on an event's detail page.
 * Lists the docs attached to this event (document.related_event_id) and lets a
 * writer add, edit, and remove them inline — each new/edited doc can be attached
 * to one of the event's tasks. Mirrors EventSpeakers: a modal form for add/edit
 * and an undoable Remove. Docs also appear in the global /docs list.
 */
export function EventDocuments({
  eventId,
  documents,
  tasks,
  canWrite,
}: {
  eventId: number;
  documents: EventDocumentRow[];
  tasks: TaskOption[];
  canWrite: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<EventDocumentRow | null>(null);

  return (
    <SectionCard
      title={`Documents · ${documents.length}`}
      action={
        canWrite ? (
          <button type="button" className={buttonGhost} onClick={() => setAdding(true)}>
            + Add document
          </button>
        ) : undefined
      }
    >
      {documents.length === 0 ? (
        <EmptyState>
          {canWrite
            ? "No documents yet. Add notes, a run sheet, or a deliverable — and attach it to one of this event's tasks if you like."
            : "No documents yet."}
        </EmptyState>
      ) : (
        <ul className="divide-y divide-border">
          {documents.map((d) => (
            <li key={d.id} className="group flex items-start gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/docs/${d.id}`}
                    className="truncate text-sm font-medium hover:text-accent-text"
                  >
                    {d.title}
                  </Link>
                  {d.type && <Badge variant="neutral">{d.type}</Badge>}
                  <Badge variant={docStatusVariant(d.status)}>{d.status ?? "Draft"}</Badge>
                </div>
                <div className="mt-1 truncate text-xs text-muted">
                  {d.relatedTaskId && d.relatedTaskTitle && (
                    <>
                      <span aria-hidden>↳ </span>
                      <Link href={`/tasks/${d.relatedTaskId}/edit`} className="hover:text-foreground">
                        {d.relatedTaskTitle}
                      </Link>
                      {d.updatedAt && " · "}
                    </>
                  )}
                  {d.updatedAt && `updated ${formatDate(d.updatedAt)}`}
                </div>
              </div>
              {canWrite && (
                <div className="flex shrink-0 items-center gap-2">
                  <button type="button" className={buttonGhost} onClick={() => setEditing(d)}>
                    Edit
                  </button>
                  <UndoButton
                    action={archiveEventDocument.bind(null, d.id, eventId)}
                    confirm="Remove this document?"
                    className={buttonGhost}
                  >
                    Remove
                  </UndoButton>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Add document">
        <DocForm
          action={createEventDocument.bind(null, eventId)}
          tasks={tasks}
          submitLabel="Add document"
          onSuccess={() => setAdding(false)}
          onCancel={() => setAdding(false)}
        />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit document">
        {editing && (
          <DocForm
            action={updateEventDocument.bind(null, editing.id, eventId)}
            doc={editing}
            tasks={tasks}
            submitLabel="Save changes"
            onSuccess={() => setEditing(null)}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>
    </SectionCard>
  );
}

function DocForm({
  action,
  doc,
  tasks,
  submitLabel,
  onSuccess,
  onCancel,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  doc?: EventDocumentRow;
  tasks: TaskOption[];
  submitLabel: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, undefined);
  useUndoToast(state);
  const [content, setContent] = useState(doc?.content ?? "");
  // A compact single-column editor: the toggle swaps the textarea for a rendered
  // preview in place (the modal can't fit them side by side like the full editor).
  const [view, setView] = useState<"write" | "preview">("write");
  const contentId = useId();

  useEffect(() => {
    if (state?.ok) onSuccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="space-y-5">
      <FormError>{state?.error}</FormError>

      <Field label="Title">
        <TextInput name="title" required defaultValue={doc?.title ?? ""} placeholder="e.g. Run sheet" />
      </Field>

      <div className="grid gap-5 sm:grid-cols-3">
        <Field label="Type">
          <SelectField name="type" defaultValue={doc?.type ?? "Note"}>
            {DOC_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </SelectField>
        </Field>
        <Field label="Status">
          <SelectField name="status" defaultValue={doc?.status ?? "Draft"}>
            {DOC_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </SelectField>
        </Field>
        <Field label="Related task" hint="Attach to one of this event's tasks">
          <SelectField
            name="related_task_id"
            defaultValue={doc?.relatedTaskId ? String(doc.relatedTaskId) : ""}
          >
            <option value="">— none —</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </SelectField>
        </Field>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <label htmlFor={contentId} className="text-sm text-muted">
            Content
          </label>
          <Segmented
            options={[
              { value: "write", label: "Write" },
              { value: "preview", label: "Preview" },
            ]}
            value={view}
            onChange={setView}
          />
        </div>
        {/* Keep the textarea mounted (just hidden) when previewing so its value
            still posts with the form. */}
        <div className={cn(view === "write" ? "block" : "hidden")}>
          <TextArea
            id={contentId}
            name="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write in Markdown…"
            className="h-64 resize-none font-mono text-[0.8rem] leading-relaxed"
          />
        </div>
        {view === "preview" && (
          <div className="h-64 overflow-y-auto rounded-md border border-border bg-surface px-4 py-3">
            {content.trim() ? (
              <Markdown content={content} />
            ) : (
              <p className="text-sm text-muted/70">Nothing to preview yet.</p>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton>{submitLabel}</SubmitButton>
        <button type="button" onClick={onCancel} className={buttonSecondary}>
          Cancel
        </button>
      </div>
    </form>
  );
}
