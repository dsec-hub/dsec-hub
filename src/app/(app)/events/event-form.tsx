"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { useUndoToast } from "@/lib/use-undo-toast";

import { CommitteeSelect } from "@/components/committee-select";
import { DateField } from "@/components/date-field";
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
import { TimeField } from "@/components/time-field";
import { buttonSecondary } from "@/components/ui";
import { formatDate, todayISO } from "@/lib/format";
import {
  DUSA_STATUSES,
  EVENT_FORMATS,
  EVENT_STATUSES,
  EVENT_TYPES,
  FLAGSHIP_STATE_LABELS,
  FLAGSHIP_STATES,
  FLAGSHIP_THEME_LABELS,
  FLAGSHIP_THEMES,
} from "@/lib/options";
import type { FormState } from "./actions";
import type { EventRow } from "@/lib/queries";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;
type Option = { id: number; name: string };

// DUSA submission lead times, measured back from the event's start date.
const SOFT_DAYS = 6 * 7; // 6-week soft target
const HARD_DAYS = 4 * 7; // 4-week hard deadline

// The club hosts events on Thursdays (0 = Sun … 4 = Thu … 6 = Sat), 6–8pm.
const HOST_WEEKDAY = 4;
const HOST_START_TIME = "18:00"; // default start for a fresh event (6pm)
const HOST_END_TIME = "20:00"; // default end for a fresh event (8pm)

// Default ticket-price tiers seeded on a fresh event (price in AUD, 0 = free):
// DSEC members free, DUSA members discounted, general public full price. All
// editable — tiers can be renamed, repriced, removed, or added.
const DEFAULT_TIERS: { label: string; price: string }[] = [
  { label: "DSEC members", price: "0" },
  { label: "DUSA members", price: "5" },
  { label: "General / public", price: "10" },
];

/** Format a Date as a local YYYY-MM-DD (no timezone drift from toISOString). */
function isoLocal(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Shift an ISO date (YYYY-MM-DD) by a number of days; null on bad/empty input. */
function shiftISO(iso: string, days: number): string | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + days);
  return isoLocal(d);
}

/** The next host-day (Thursday) that's at least `minLeadDays` away from today. */
function nextHostDate(minLeadDays: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + minLeadDays); // earliest acceptable date
  d.setDate(d.getDate() + ((HOST_WEEKDAY - d.getDay() + 7) % 7)); // roll forward to Thursday
  return isoLocal(d);
}

export function EventForm({
  action,
  people,
  committees,
  event,
  coOwnerIds = [],
  onSuccess,
  onCancel,
  redirectOnSuccess,
  canWrite = true,
}: {
  action: Action;
  people: Option[];
  committees: Option[];
  event?: EventRow;
  /** Additional event owners beyond the primary lead (pre-selected on edit). */
  coOwnerIds?: number[];
  onSuccess?: (result: FormState) => void;
  onCancel?: () => void;
  redirectOnSuccess?: string;
  canWrite?: boolean;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(action, undefined);
  useUndoToast(state);
  const e = event;
  const [startDate, setStartDate] = useState(e?.startDate ?? "");
  const [endDate, setEndDate] = useState(e?.endDate ?? "");
  // New events seed the 6–8pm host slot; existing events keep their saved times
  // (DB returns "HH:MM:SS" — TimeField trims the seconds).
  const [startTime, setStartTime] = useState(
    event ? e?.startTime ?? "" : HOST_START_TIME,
  );
  const [endTime, setEndTime] = useState(event ? e?.endTime ?? "" : HOST_END_TIME);
  // Once the user picks a distinct end date we stop mirroring the start date; an
  // existing multi-day event counts as already-customised.
  const [endTouched, setEndTouched] = useState(
    !!e?.endDate && e.endDate !== e.startDate,
  );
  const [status, setStatus] = useState(e?.status ?? "Idea");
  // Flagship is opt-in; its template/teaser fields only render once checked
  // (mirrors the status-driven conditional rendering idiom above).
  const [isFlagship, setIsFlagship] = useState(e?.isFlagship ?? false);

  // An event auto-completes once its start date is in the past — a completed
  // event already happened, so DUSA, scheduling and ticketing are moot. We
  // *derive* the effective status instead of storing it, so the rule applies on
  // load and whenever the date changes without a state-syncing effect. A manual
  // "Cancelled" still wins; the select posts this derived value.
  const isPast = !!startDate && startDate < todayISO();
  const effectiveStatus = isPast && status !== "Cancelled" ? "Completed" : status;
  const isCompleted = effectiveStatus === "Completed";

  useEffect(() => {
    if (!state?.ok) return;
    if (onSuccess) onSuccess(state);
    else if (redirectOnSuccess) router.push(redirectOnSuccess);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Changing the start date mirrors onto the end date until the user picks a
  // different end, and never lets the end fall before the start.
  function onStartChange(iso: string) {
    setStartDate(iso);
    if (!endTouched) setEndDate(iso);
    else if (iso && endDate && endDate < iso) setEndDate(iso);
  }

  return (
    <form action={formAction} className="max-w-3xl space-y-6">
      <fieldset disabled={!canWrite} className="space-y-6">
      <FormError>{state?.error}</FormError>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name">
          <TextInput name="name" required defaultValue={e?.name ?? ""} />
        </Field>
        <Field label="Type">
          <SelectField name="type" defaultValue={e?.type ?? ""}>
            <option value="">—</option>
            {EVENT_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </SelectField>
        </Field>
        <Field
          label="Status"
          hint="Past-dated events auto-complete; completed events hide DUSA + ticketing."
        >
          <SelectField
            name="status"
            value={effectiveStatus}
            onChange={(ev) => setStatus(ev.target.value)}
          >
            {EVENT_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </SelectField>
        </Field>
        <Field label="Committee">
          <CommitteeSelect committees={committees} defaultValue={e?.committee} />
        </Field>
        <Field label="Start date" hint="We host on Thursdays, 6–8pm.">
          <DateField name="start_date" value={startDate} onChange={onStartChange} />
          {!isCompleted && (
            <button
              type="button"
              onClick={() => onStartChange(nextHostDate(SOFT_DAYS))}
              className="mt-1.5 self-start text-xs font-medium text-accent-text hover:underline"
            >
              ⏱ Suggest next best Thursday →
            </button>
          )}
        </Field>
        <Field label="Start time" hint="When the event begins (optional).">
          <TimeField name="start_time" value={startTime} onChange={setStartTime} />
        </Field>
        <Field
          label="End date"
          hint={
            !endTouched && startDate
              ? "Mirrors the start date until you change it."
              : undefined
          }
        >
          <DateField
            name="end_date"
            value={endDate}
            onChange={(iso) => {
              setEndTouched(true);
              setEndDate(iso);
            }}
            min={startDate || undefined}
          />
        </Field>
        <Field label="End time" hint="When the event wraps up (optional).">
          <TimeField name="end_time" value={endTime} onChange={setEndTime} />
        </Field>
        <Field label="Event lead">
          <SelectField
            name="event_lead_id"
            defaultValue={e?.eventLeadId ? String(e.eventLeadId) : ""}
          >
            <option value="">—</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </SelectField>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Co-leads" hint="Extra people running this event, beyond the lead.">
            <PeopleMultiSelect
              name="co_owner_ids"
              people={people}
              defaultSelected={coOwnerIds}
              excludeId={e?.eventLeadId ?? null}
            />
          </Field>
        </div>
        <Field label="Format">
          <SelectField name="format" defaultValue={e?.format ?? ""}>
            <option value="">—</option>
            {EVENT_FORMATS.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </SelectField>
        </Field>
        <Field label="Venue">
          <TextInput name="venue" defaultValue={e?.venue ?? ""} />
        </Field>
        <Field label="Trimester">
          <TextInput
            name="trimester"
            defaultValue={e?.trimester ?? ""}
            placeholder="e.g. T2 2026"
          />
        </Field>
        {isCompleted ? (
          // Expected attendance is redundant once an event is done — keep the
          // saved value but hide the field; actual attendance stays editable.
          <input
            type="hidden"
            name="expected_attendance"
            value={e?.expectedAttendance ?? ""}
          />
        ) : (
          <Field label="Expected attendance">
            <TextInput
              type="number"
              name="expected_attendance"
              defaultValue={e?.expectedAttendance ?? ""}
            />
          </Field>
        )}
        <Field label="Actual attendance">
          <TextInput
            type="number"
            name="actual_attendance"
            defaultValue={e?.actualAttendance ?? ""}
          />
        </Field>
      </div>

      {/* Food applies to past and upcoming events alike, so it's always shown. */}
      <div className="flex flex-wrap gap-5">
        <CheckboxField
          label="Food included"
          name="food_provided"
          defaultChecked={e?.foodProvided ?? false}
        />
      </div>

      {isCompleted ? (
        // Completed/past events don't sell tickets — hide the link + prices, but
        // preserve any saved values so marking complete never wipes them.
        <>
          <input type="hidden" name="ticket_url" value={e?.ticketUrl ?? ""} />
          <input
            type="hidden"
            name="ticket_tiers"
            value={JSON.stringify(e?.ticketTiers ?? [])}
          />
        </>
      ) : (
        <fieldset className="rounded-xl border border-border p-4">
          <legend className="px-1 text-xs text-muted">Tickets</legend>
          <div className="grid gap-5">
            <Field
              label="Ticket / register link"
              hint="Public buy-tickets or RSVP URL. Shown on the website event page."
            >
              <TextInput
                type="url"
                name="ticket_url"
                defaultValue={e?.ticketUrl ?? ""}
                placeholder="https://…"
              />
            </Field>
            <Field
              label="Ticket pricing"
              hint="Price per audience. Blank = unset; 0 = free. Add custom tiers as needed."
            >
              <TicketTiers defaultValue={e?.ticketTiers} />
            </Field>
          </div>
        </fieldset>
      )}

      {isCompleted ? (
        // Completed events don't need DUSA tracking. Preserve existing values via
        // hidden inputs so marking an event complete never wipes them.
        <p className="rounded-xl border border-border bg-surface px-4 py-3 text-xs text-muted">
          DUSA submission and ticketing aren&apos;t tracked for completed events.
          <input
            type="hidden"
            name="dusa_submission_status"
            value={e?.dusaSubmissionStatus ?? "Not Started"}
          />
          {e?.dusaDeadline && (
            <input type="hidden" name="dusa_deadline" value={e.dusaDeadline} />
          )}
          {e?.dusaRequired && <input type="hidden" name="dusa_required" value="on" />}
          {e?.externalGuests && (
            <input type="hidden" name="external_guests" value="on" />
          )}
        </p>
      ) : (
        <fieldset className="rounded-xl border border-border p-4">
          <legend className="px-1 text-xs text-muted">DUSA</legend>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Submission status">
              <SelectField
                name="dusa_submission_status"
                defaultValue={e?.dusaSubmissionStatus ?? "Not Started"}
              >
                {DUSA_STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </SelectField>
            </Field>
            <DusaDeadline startDate={startDate} defaultValue={e?.dusaDeadline ?? ""} />
          </div>
          <div className="mt-4 flex flex-wrap gap-5">
            <CheckboxField
              label="DUSA required"
              name="dusa_required"
              defaultChecked={e?.dusaRequired ?? false}
            />
            <CheckboxField
              label="External guests"
              name="external_guests"
              defaultChecked={e?.externalGuests ?? false}
            />
          </div>
        </fieldset>
      )}

      <Field label="Description" hint="Shown on the public website. Markdown supported.">
        <TextArea name="description" rows={8} defaultValue={e?.description ?? ""} />
      </Field>

      <fieldset className="rounded-xl border border-border p-4">
        <legend className="px-1 text-xs text-muted">Flagship</legend>
        <div className="space-y-5">
          <CheckboxField
            label="Mark as flagship event"
            name="is_flagship"
            checked={isFlagship}
            onChange={(ev) => setIsFlagship(ev.target.checked)}
          />
          {isFlagship && (
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Template theme"
                hint="Which bespoke website template renders the teaser + reveal pages."
              >
                <SelectField name="flagship_theme" defaultValue={e?.flagshipTheme ?? "arena"}>
                  {FLAGSHIP_THEMES.map((t) => (
                    <option key={t} value={t}>
                      {FLAGSHIP_THEME_LABELS[t]}
                    </option>
                  ))}
                </SelectField>
              </Field>
              <Field
                label="State"
                hint="Teaser hides the real specifics; Revealed shows the full event page."
              >
                <SelectField name="flagship_state" defaultValue={e?.flagshipState ?? "teaser"}>
                  {FLAGSHIP_STATES.map((s) => (
                    <option key={s} value={s}>
                      {FLAGSHIP_STATE_LABELS[s]}
                    </option>
                  ))}
                </SelectField>
              </Field>
              <div className="sm:col-span-2">
                <Field
                  label="Secret teaser title"
                  hint="Headline shown while teased, before the reveal (e.g. “OPERATION DUCKSHOT”)."
                >
                  <TextInput
                    name="flagship_teaser_title"
                    defaultValue={e?.flagshipTeaserTitle ?? ""}
                    placeholder="OPERATION DUCKSHOT"
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field
                  label="Secret teaser body"
                  hint="Teaser blurb shown before the reveal. Markdown supported."
                >
                  <TextArea
                    name="flagship_teaser_body"
                    rows={5}
                    defaultValue={e?.flagshipTeaserBody ?? ""}
                  />
                </Field>
              </div>
              <Field
                label="Reveal date"
                hint="Optional countdown target. Falls back to the start date when unset."
              >
                <DateField
                  name="flagship_reveal_at"
                  defaultValue={e?.flagshipRevealAt?.slice(0, 10) ?? ""}
                />
              </Field>
            </div>
          )}
        </div>
      </fieldset>

      <p className="rounded-xl border border-border bg-surface px-4 py-3 text-xs text-muted">
        Sponsors and partners are linked from their own sections (below on the
        event page, or in the “New event” dialog) — each shows its logo on the
        public event page.
      </p>
      </fieldset>

      <div className="flex items-center gap-3">
        {canWrite ? (
          <SubmitButton>{event ? "Save changes" : "Create event"}</SubmitButton>
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
          <Link href="/events" className={buttonSecondary}>
            Cancel
          </Link>
        )}
      </div>
    </form>
  );
}

/**
 * Editable list of ticket-price tiers, serialised to a hidden input as JSON
 * (`[{label, price}]`) and parsed back with `tierList`. Seeds three default
 * audiences on a fresh event; the exec can rename, reprice, remove, or add.
 */
function TicketTiers({
  defaultValue,
}: {
  defaultValue?: { label: string; price: number | null }[] | null;
}) {
  const [tiers, setTiers] = useState<{ label: string; price: string }[]>(() =>
    defaultValue && defaultValue.length
      ? defaultValue.map((t) => ({
          label: t.label ?? "",
          price: t.price == null ? "" : String(t.price),
        }))
      : DEFAULT_TIERS.map((t) => ({ ...t })),
  );

  // Serialise to the wire shape: price → number (0 = free) or null (unset);
  // unlabelled rows are dropped so a half-typed custom row never persists.
  const serialized = JSON.stringify(
    tiers
      .map((t) => ({
        label: (t.label ?? "").trim(),
        price: (t.price ?? "").trim() === "" ? null : Number(t.price),
      }))
      .filter((t) => t.label && (t.price === null || !Number.isNaN(t.price))),
  );

  const update = (i: number, patch: Partial<{ label: string; price: string }>) =>
    setTiers((prev) => prev.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name="ticket_tiers" value={serialized} />
      {tiers.map((t, i) => {
        const free = (t.price ?? "").trim() === "0";
        return (
          <div key={i} className="flex items-center gap-2">
            <TextInput
              aria-label="Tier name"
              placeholder="Audience"
              value={t.label}
              onChange={(ev) => update(i, { label: ev.target.value })}
              className="flex-1"
            />
            <div className="relative w-28">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                $
              </span>
              <TextInput
                aria-label="Price in AUD (0 = free)"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                placeholder="—"
                value={t.price}
                onChange={(ev) => update(i, { price: ev.target.value })}
                className="pl-6"
              />
            </div>
            <span className="w-9 text-xs text-success">{free ? "Free" : ""}</span>
            <button
              type="button"
              onClick={() => setTiers((prev) => prev.filter((_, j) => j !== i))}
              aria-label={`Remove ${t.label || "tier"}`}
              className="rounded-md px-2 py-1 text-lg leading-none text-muted transition-colors hover:bg-elevated hover:text-danger"
            >
              ×
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => setTiers((prev) => [...prev, { label: "", price: "" }])}
        className="self-start text-xs font-medium text-accent-text hover:underline"
      >
        + Add tier
      </button>
    </div>
  );
}

/**
 * DUSA deadline field. Auto-derives the hard deadline (4 weeks before the event)
 * from the start date, while letting the user override it. Surfaces the 6-week
 * soft target and warns when the event is too soon to submit in time.
 */
function DusaDeadline({
  startDate,
  defaultValue,
}: {
  startDate: string;
  defaultValue: string;
}) {
  const soft = shiftISO(startDate, -SOFT_DAYS);
  const hard = shiftISO(startDate, -HARD_DAYS);

  // Until the user edits it (or a saved value exists), the field follows the
  // computed hard deadline. `override` of null = "auto"; "" = explicitly cleared.
  const [override, setOverride] = useState<string | null>(defaultValue || null);
  const value = override ?? hard ?? "";

  const today = todayISO();
  let warning: { tone: "danger" | "warning"; text: string } | null = null;
  if (startDate && hard && soft) {
    if (hard < today) {
      const earliestHard = nextHostDate(HARD_DAYS);
      const earliestSoft = nextHostDate(SOFT_DAYS);
      warning = {
        tone: "danger",
        text:
          `Too soon to meet DUSA's 4-week deadline (${formatDate(hard)} is past). ` +
          `Next Thursday that works: ${formatDate(earliestHard)} ` +
          `(ideally ${formatDate(earliestSoft)} for the 6-week target).`,
      };
    } else if (soft < today) {
      warning = {
        tone: "warning",
        text: `Past the 6-week soft target (${formatDate(soft)}). Submit ASAP — hard deadline ${formatDate(hard)}.`,
      };
    }
  }

  return (
    <Field
      label="Deadline"
      hint={
        startDate
          ? `Auto: hard ${formatDate(hard)} (4 wks) · soft ${formatDate(soft)} (6 wks). Editable.`
          : "Set a start date to auto-fill the 4-week hard deadline."
      }
    >
      <DateField name="dusa_deadline" value={value} onChange={(iso) => setOverride(iso)} />
      {warning && (
        <p
          className={
            warning.tone === "danger"
              ? "mt-1.5 rounded-md bg-danger/10 px-2.5 py-1.5 text-xs text-danger"
              : "mt-1.5 rounded-md bg-warning/10 px-2.5 py-1.5 text-xs text-warning"
          }
        >
          {warning.text}
        </p>
      )}
    </Field>
  );
}
