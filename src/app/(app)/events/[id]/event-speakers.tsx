"use client";

import { useActionState, useEffect, useState } from "react";

import { Field, FormError, SelectField, TextArea, TextInput } from "@/components/form";
import { MediaManager } from "@/components/media-manager";
import { Modal } from "@/components/modal";
import { SubmitButton } from "@/components/submit-button";
import { UndoButton } from "@/components/undo-button";
import { Badge, EmptyState, SectionCard, buttonGhost, buttonSecondary } from "@/components/ui";
import { useUndoToast } from "@/lib/use-undo-toast";
import type { EventSpeakerRow, Option } from "@/lib/workspace-queries";

import {
  createEventSpeaker,
  deleteEventSpeaker,
  updateEventSpeaker,
  type FormState,
} from "../speaker-actions";

export function EventSpeakers({
  eventId,
  speakers,
  people,
  canWrite,
}: {
  eventId: number;
  speakers: EventSpeakerRow[];
  people: Option[];
  canWrite: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<EventSpeakerRow | null>(null);

  return (
    <SectionCard
      title={`Speakers · ${speakers.length}`}
      action={
        canWrite ? (
          <button type="button" className={buttonGhost} onClick={() => setAdding(true)}>
            + Add speaker
          </button>
        ) : undefined
      }
    >
      {speakers.length === 0 ? (
        <EmptyState>
          {canWrite
            ? "No speakers yet. Add a guest or link someone from the directory — their photo shows on the public event page."
            : "No speakers yet."}
        </EmptyState>
      ) : (
        <div className="space-y-4 px-5 py-5">
          {speakers.map((sp) => {
            const ownPhoto = sp.photos[0]?.webpUrl ?? null;
            const effectivePhoto = ownPhoto ?? sp.inheritedPhoto;
            const inheriting = !ownPhoto && !!sp.inheritedPhoto;
            return (
            <div key={sp.id} className="rounded-lg border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  {effectivePhoto && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={effectivePhoto}
                      alt=""
                      className="size-10 shrink-0 rounded-full object-cover"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{sp.displayName}</span>
                      {sp.personId && <Badge variant="neutral">Linked</Badge>}
                    </div>
                    {sp.title && <div className="text-xs text-muted">{sp.title}</div>}
                    {sp.bio && <p className="mt-1 text-xs text-muted/80">{sp.bio}</p>}
                  </div>
                </div>
                {canWrite && (
                  <div className="flex shrink-0 items-center gap-2">
                    <button type="button" className={buttonGhost} onClick={() => setEditing(sp)}>
                      Edit
                    </button>
                    <UndoButton
                      action={deleteEventSpeaker.bind(null, sp.id, eventId)}
                      confirm="Remove this speaker?"
                      className={buttonGhost}
                    >
                      Remove
                    </UndoButton>
                  </div>
                )}
              </div>
              <div className="mt-4">
                <MediaManager
                  entityType="speaker"
                  entityId={sp.id}
                  existing={sp.photos}
                  canWrite={canWrite}
                  emptyOverride={
                    inheriting
                      ? canWrite
                        ? `Using ${sp.displayName}'s profile photo. Add one here only to use a different photo for this event.`
                        : `Using ${sp.displayName}'s profile photo.`
                      : undefined
                  }
                />
              </div>
            </div>
            );
          })}
        </div>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Add speaker">
        <SpeakerForm
          action={createEventSpeaker.bind(null, eventId)}
          people={people}
          submitLabel="Add speaker"
          onSuccess={() => setAdding(false)}
          onCancel={() => setAdding(false)}
        />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit speaker">
        {editing && (
          <SpeakerForm
            action={updateEventSpeaker.bind(null, editing.id, eventId)}
            people={people}
            speaker={editing}
            submitLabel="Save changes"
            onSuccess={() => setEditing(null)}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>
    </SectionCard>
  );
}

function SpeakerForm({
  action,
  people,
  speaker,
  submitLabel,
  onSuccess,
  onCancel,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  people: Option[];
  speaker?: EventSpeakerRow;
  submitLabel: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, undefined);
  useUndoToast(state);

  useEffect(() => {
    if (state?.ok) onSuccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="space-y-5">
      <FormError>{state?.error}</FormError>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Person" hint="From the directory — or use the name field for a guest.">
          <SelectField name="person_id" defaultValue={speaker?.personId ? String(speaker.personId) : ""}>
            <option value="">— external / guest —</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </SelectField>
        </Field>
        <Field label="Name" hint="For a guest not in the directory.">
          <TextInput name="name" defaultValue={speaker?.name ?? ""} placeholder="e.g. Jane Doe" />
        </Field>
      </div>

      <Field label="Title" hint="Role / organisation, e.g. “CTO at Acme”.">
        <TextInput name="title" defaultValue={speaker?.title ?? ""} />
      </Field>

      <Field label="Bio">
        <TextArea name="bio" defaultValue={speaker?.bio ?? ""} />
      </Field>

      <div className="flex items-center gap-3">
        <SubmitButton>{submitLabel}</SubmitButton>
        <button type="button" onClick={onCancel} className={buttonSecondary}>
          Cancel
        </button>
      </div>
    </form>
  );
}
