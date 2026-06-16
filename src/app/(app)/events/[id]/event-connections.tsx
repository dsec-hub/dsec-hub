"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";

import { Field, FormError, SelectField, TextInput } from "@/components/form";
import { Modal } from "@/components/modal";
import { SubmitButton } from "@/components/submit-button";
import { UndoButton } from "@/components/undo-button";
import { Badge, EmptyState, SectionCard, buttonGhost, buttonSecondary } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { eventStatusVariant } from "@/lib/options";
import { useUndoToast } from "@/lib/use-undo-toast";
import type { EventConnectionRow, Option } from "@/lib/workspace-queries";

import { addEventConnection, removeEventConnection, type FormState } from "../speaker-actions";

export function EventConnections({
  eventId,
  linked,
  eventOptions,
  canWrite,
}: {
  eventId: number;
  linked: EventConnectionRow[];
  eventOptions: Option[];
  canWrite: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const linkedIds = new Set(linked.map((l) => l.otherId));
  // An event can't be connected to itself or to one it's already connected to.
  const available = eventOptions.filter((e) => e.id !== eventId && !linkedIds.has(e.id));

  return (
    <SectionCard
      title={`Related events · ${linked.length}`}
      action={
        canWrite ? (
          <button type="button" className={buttonGhost} onClick={() => setAdding(true)}>
            + Connect event
          </button>
        ) : undefined
      }
    >
      {linked.length === 0 ? (
        <EmptyState>
          {canWrite
            ? "No connected events. Link a related event to show how they connect."
            : "No connected events."}
        </EmptyState>
      ) : (
        <ul className="divide-y divide-border">
          {linked.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-4 px-5 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/events/${l.otherId}`}
                    className="truncate text-sm font-medium hover:text-accent-text"
                  >
                    {l.name}
                  </Link>
                  {l.label && <Badge variant="accent">{l.label}</Badge>}
                  {!l.isPublic && <Badge variant="warning">Draft</Badge>}
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                  <Badge variant={eventStatusVariant(l.status)}>{l.status ?? "—"}</Badge>
                  <span>{l.startDate ? formatDate(l.startDate) : "No date"}</span>
                </div>
              </div>
              {canWrite && (
                <UndoButton
                  action={removeEventConnection.bind(null, l.id, eventId)}
                  className={buttonGhost}
                >
                  Remove
                </UndoButton>
              )}
            </li>
          ))}
        </ul>
      )}

      {linked.length > 0 && (
        <p className="px-5 pb-4 text-xs text-muted">
          Connections are symmetric — they show on both events. Published ones also
          appear on the public event page.
        </p>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Connect a related event">
        <AddConnectionForm
          eventId={eventId}
          available={available}
          onSuccess={() => setAdding(false)}
          onCancel={() => setAdding(false)}
        />
      </Modal>
    </SectionCard>
  );
}

function AddConnectionForm({
  eventId,
  available,
  onSuccess,
  onCancel,
}: {
  eventId: number;
  available: Option[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const action = addEventConnection.bind(null, eventId);
  const [state, formAction] = useActionState<FormState, FormData>(action, undefined);
  useUndoToast(state);

  useEffect(() => {
    if (state?.ok) onSuccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (available.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted">
          No other events to connect to yet. Create another event first.
        </p>
        <button type="button" onClick={onCancel} className={buttonSecondary}>
          Close
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <FormError>{state?.error}</FormError>

      <Field label="Event">
        <SelectField name="other_event_id" defaultValue="">
          <option value="" disabled>
            — choose an event —
          </option>
          {available.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </SelectField>
      </Field>

      <Field label="Label" hint="Optional — how they relate, e.g. “Series” or “Follow-up”.">
        <TextInput name="label" placeholder="e.g. Series" />
      </Field>

      <div className="flex items-center gap-3">
        <SubmitButton>Connect event</SubmitButton>
        <button type="button" onClick={onCancel} className={buttonSecondary}>
          Cancel
        </button>
      </div>
    </form>
  );
}
