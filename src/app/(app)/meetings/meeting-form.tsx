"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";

import { Field, FormError, SelectField, TextArea, TextInput } from "@/components/form";
import { DateField } from "@/components/date-field";
import { SubmitButton } from "@/components/submit-button";
import { Badge, buttonGhost, buttonSecondary } from "@/components/ui";
import { MEETING_STATUSES, MEETING_TYPES } from "@/lib/workspace-options";
import { normaliseAttendees } from "@/lib/workspace-options";
import { useActionToast } from "@/lib/use-action-toast";
import type { Attendee } from "@/db/workspace-schema";
import type { Option } from "@/lib/workspace-queries";
import type { FormState, MeetingRow } from "./actions";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

export function MeetingForm({
  action,
  meeting,
  events,
  people,
  onSuccess,
  onCancel,
  canWrite = true,
}: {
  action: Action;
  meeting?: MeetingRow;
  events: Option[];
  people: Option[];
  onSuccess?: () => void;
  onCancel?: () => void;
  canWrite?: boolean;
}) {
  const [state, formAction] = useActionState(action, undefined);
  useActionToast(state);
  const m = meeting;

  useEffect(() => {
    if (state?.ok) onSuccess?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="max-w-3xl space-y-6">
      <fieldset disabled={!canWrite} className="space-y-6">
        <FormError>{state?.error}</FormError>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Title">
            <TextInput name="title" required defaultValue={m?.title ?? ""} />
          </Field>
          <Field label="Type">
            <SelectField name="type" defaultValue={m?.type ?? ""}>
              <option value="">—</option>
              {MEETING_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </SelectField>
          </Field>
          <Field label="Date">
            <DateField name="meeting_date" defaultValue={m?.meetingDate ?? ""} />
          </Field>
          <Field label="Location">
            <TextInput name="location" defaultValue={m?.location ?? ""} />
          </Field>
          <Field label="Status">
            <SelectField name="status" defaultValue={m?.status ?? "Scheduled"}>
              {MEETING_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </SelectField>
          </Field>
          <Field label="Related event">
            <SelectField
              name="related_event_id"
              defaultValue={m?.relatedEventId ? String(m.relatedEventId) : ""}
            >
              <option value="">—</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </SelectField>
          </Field>
        </div>

        <Field label="Attendees" hint="Tick committee/members, and add any external guests.">
          <AttendeesField people={people} defaultValue={normaliseAttendees(m?.attendees)} />
        </Field>

        <Field
          label="Transcript"
          hint="Optional — leave blank to just log the meeting. Paste a transcript here to generate AI minutes from the edit screen."
        >
          <TextArea name="transcript" defaultValue={m?.transcript ?? ""} className="min-h-48" />
        </Field>

        <Field label="Summary">
          <TextArea name="summary" defaultValue={m?.summary ?? ""} />
        </Field>

        <Field label="Notes" hint="Markdown supported.">
          <TextArea name="notes" defaultValue={m?.notes ?? ""} />
        </Field>
      </fieldset>

      <div className="flex items-center gap-3">
        {canWrite ? (
          <SubmitButton>{meeting ? "Save changes" : "Create meeting"}</SubmitButton>
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
          <Link href="/meetings" className={buttonSecondary}>
            Cancel
          </Link>
        )}
      </div>
    </form>
  );
}

/**
 * Attendee picker: a checkbox list of people from the directory plus free-text
 * guests. Serialises the combined selection to a hidden `attendees` input as a
 * JSON array of { personId?, name } — parsed back in the server action.
 */
function AttendeesField({
  people,
  defaultValue,
}: {
  people: Option[];
  defaultValue: Attendee[];
}) {
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(defaultValue.filter((a) => a.personId).map((a) => a.personId as number)),
  );
  const [guests, setGuests] = useState<string[]>(() =>
    defaultValue.filter((a) => !a.personId).map((a) => a.name),
  );
  const [guestInput, setGuestInput] = useState("");

  const attendees: Attendee[] = [
    ...people.filter((p) => selected.has(p.id)).map((p) => ({ personId: p.id, name: p.name })),
    ...guests.map((name) => ({ name })),
  ];

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addGuest() {
    const name = guestInput.trim();
    if (name && !guests.includes(name)) setGuests((g) => [...g, name]);
    setGuestInput("");
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name="attendees" value={JSON.stringify(attendees)} />

      {people.length > 0 && (
        <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-surface p-2">
          <div className="grid gap-1 sm:grid-cols-2">
            {people.map((p) => (
              <label
                key={p.id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-elevated"
              >
                <input
                  type="checkbox"
                  checked={selected.has(p.id)}
                  onChange={() => toggle(p.id)}
                  className="size-4 rounded border-border bg-background accent-[var(--color-accent)]"
                />
                <span className="truncate">{p.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {guests.map((g) => (
          <span key={g} className="inline-flex items-center gap-1">
            <Badge variant="neutral">{g}</Badge>
            <button
              type="button"
              aria-label={`Remove ${g}`}
              onClick={() => setGuests((gs) => gs.filter((x) => x !== g))}
              className="text-xs text-muted hover:text-danger"
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <TextInput
          value={guestInput}
          onChange={(e) => setGuestInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addGuest();
            }
          }}
          placeholder="Add a guest (not in the directory)…"
        />
        <button type="button" onClick={addGuest} className={buttonGhost}>
          Add guest
        </button>
      </div>
    </div>
  );
}
