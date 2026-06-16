"use client";

import { useActionState, useEffect, useState } from "react";

import { Field, FormError, SelectField, TextInput } from "@/components/form";
import { Modal } from "@/components/modal";
import { SubmitButton } from "@/components/submit-button";
import { Badge, EmptyState, SectionCard, buttonGhost, buttonSecondary } from "@/components/ui";
import { SPONSOR_CONTACT_ROLES } from "@/lib/options";
import { useActionToast } from "@/lib/use-action-toast";
import type { Option } from "@/lib/workspace-queries";
import type { SponsorContactRow } from "@/lib/workspace-queries";

import { addSponsorContact, deleteSponsorContact, type FormState } from "../actions";

export function SponsorContacts({
  sponsorId,
  contacts,
  people,
  canWrite,
}: {
  sponsorId: number;
  contacts: SponsorContactRow[];
  people: Option[];
  canWrite: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <SectionCard
      title={`Contacts · ${contacts.length}`}
      action={
        canWrite ? (
          <button type="button" className={buttonGhost} onClick={() => setOpen(true)}>
            + Add contact
          </button>
        ) : undefined
      }
    >
      {contacts.length === 0 ? (
        <EmptyState>No contacts yet — add the organiser and key people.</EmptyState>
      ) : (
        <ul className="divide-y divide-border">
          {contacts.map((c) => {
            const name = c.personName ?? c.name ?? "—";
            const email = c.personEmail ?? c.email;
            return (
              <li key={c.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{name}</span>
                    {c.role && <Badge variant="accent">{c.role}</Badge>}
                    {c.personId && <Badge variant="neutral">Linked</Badge>}
                  </div>
                  <div className="truncate text-xs text-muted">
                    {[email, c.phone].filter(Boolean).join(" · ") || "—"}
                  </div>
                  {c.notes && <div className="mt-0.5 text-xs text-muted/80">{c.notes}</div>}
                </div>
                {canWrite && (
                  <form action={deleteSponsorContact.bind(null, c.id, sponsorId)}>
                    <button className={buttonGhost} aria-label={`Remove ${name}`}>
                      Remove
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Add contact">
        <AddContactForm
          sponsorId={sponsorId}
          people={people}
          onSuccess={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </Modal>
    </SectionCard>
  );
}

function AddContactForm({
  sponsorId,
  people,
  onSuccess,
  onCancel,
}: {
  sponsorId: number;
  people: Option[];
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const action = addSponsorContact.bind(null, sponsorId);
  const [state, formAction] = useActionState<FormState, FormData>(action, undefined);
  useActionToast(state);

  useEffect(() => {
    if (state?.ok) onSuccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="space-y-5">
      <FormError>{state?.error}</FormError>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Person" hint="From the directory — or use the name field below.">
          <SelectField name="person_id" defaultValue="">
            <option value="">— external / not listed —</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </SelectField>
        </Field>
        <Field label="Role">
          <SelectField name="role" defaultValue="Contact">
            {SPONSOR_CONTACT_ROLES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </SelectField>
        </Field>
        <Field label="Name" hint="For someone not in the directory.">
          <TextInput name="name" placeholder="e.g. Jane Doe" />
        </Field>
        <Field label="Email">
          <TextInput type="email" name="email" />
        </Field>
        <Field label="Phone">
          <TextInput name="phone" />
        </Field>
      </div>

      <Field label="Notes">
        <TextInput name="notes" />
      </Field>

      <div className="flex items-center gap-3">
        <SubmitButton>Add contact</SubmitButton>
        <button type="button" onClick={onCancel} className={buttonSecondary}>
          Cancel
        </button>
      </div>
    </form>
  );
}
