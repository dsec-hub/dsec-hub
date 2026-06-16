"use client";

import { useActionState, useEffect, useState } from "react";

import { Field, FormError, SelectField, TextInput } from "@/components/form";
import { Modal } from "@/components/modal";
import { SubmitButton } from "@/components/submit-button";
import { UndoButton } from "@/components/undo-button";
import { Badge, EmptyState, SectionCard, buttonGhost, buttonSecondary } from "@/components/ui";
import { useUndoToast } from "@/lib/use-undo-toast";
import type { EventSponsorRow, Option } from "@/lib/workspace-queries";

import { addEventSponsor, removeEventSponsor, type FormState } from "../speaker-actions";

export function EventSponsors({
  eventId,
  linked,
  sponsorOptions,
  canWrite,
}: {
  eventId: number;
  linked: EventSponsorRow[];
  sponsorOptions: Option[];
  canWrite: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const linkedIds = new Set(linked.map((l) => l.sponsorId));
  const available = sponsorOptions.filter((s) => !linkedIds.has(s.id));

  return (
    <SectionCard
      title={`Sponsors · ${linked.length}`}
      action={
        canWrite ? (
          <button type="button" className={buttonGhost} onClick={() => setAdding(true)}>
            + Add sponsor
          </button>
        ) : undefined
      }
    >
      {linked.length === 0 ? (
        <EmptyState>
          {canWrite
            ? "No sponsors linked. Add a sponsor to show its logo on the public event page."
            : "No sponsors linked."}
        </EmptyState>
      ) : (
        <ul className="divide-y divide-border">
          {linked.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-4 px-5 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid size-12 shrink-0 place-items-center rounded-md border border-border bg-elevated">
                  {l.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={l.logo.webpUrl}
                      alt={`${l.organisation} logo`}
                      className="max-h-10 max-w-10 object-contain"
                    />
                  ) : (
                    <span className="text-[10px] text-muted">No logo</span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{l.organisation}</span>
                    {l.tier && <Badge variant="accent">{l.tier}</Badge>}
                  </div>
                  {l.website && (
                    <a
                      href={l.website}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="truncate text-xs text-muted hover:text-foreground"
                    >
                      {l.website}
                    </a>
                  )}
                </div>
              </div>
              {canWrite && (
                <UndoButton
                  action={removeEventSponsor.bind(null, l.id, eventId)}
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
          Logos come from each sponsor’s profile. No logo? Upload one on the sponsor’s page.
        </p>
      )}

      <Modal open={adding} onClose={() => setAdding(false)} title="Add sponsor to event">
        <AddSponsorForm
          eventId={eventId}
          available={available}
          onSuccess={() => setAdding(false)}
          onCancel={() => setAdding(false)}
        />
      </Modal>
    </SectionCard>
  );
}

function AddSponsorForm({
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
  const action = addEventSponsor.bind(null, eventId);
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
          Every sponsor is already linked. Create more on the Sponsors page first.
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

      <Field label="Sponsor">
        <SelectField name="sponsor_id" defaultValue="">
          <option value="" disabled>
            — choose a sponsor —
          </option>
          {available.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>
      </Field>

      <Field label="Tier" hint="Optional label for this event, e.g. “Gold”.">
        <TextInput name="tier" placeholder="e.g. Gold" />
      </Field>

      <div className="flex items-center gap-3">
        <SubmitButton>Add sponsor</SubmitButton>
        <button type="button" onClick={onCancel} className={buttonSecondary}>
          Cancel
        </button>
      </div>
    </form>
  );
}
