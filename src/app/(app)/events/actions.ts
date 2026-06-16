"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { events, finance } from "@/db/schema";
import { requireWrite } from "@/lib/dal";
import { bool, int, str, tierList } from "@/lib/form-data";
import { DUSA_STATUSES } from "@/lib/options";
import { apiEnv } from "@/lib/api-env";
import { revalidateWebsite } from "@/lib/revalidate-website";
import { archiveToken, createToken, snapshotForDelete, snapshotForUpdate } from "@/lib/undo";
import type { ActionResult } from "@/lib/undo-types";

export type FormState = ActionResult;

function parseEvent(fd: FormData) {
  return {
    name: str(fd, "name") ?? "",
    type: str(fd, "type"),
    status: str(fd, "status"),
    startDate: str(fd, "start_date"),
    endDate: str(fd, "end_date"),
    startTime: str(fd, "start_time"),
    endTime: str(fd, "end_time"),
    trimester: str(fd, "trimester"),
    format: str(fd, "format"),
    venue: str(fd, "venue"),
    ticketUrl: str(fd, "ticket_url"),
    ticketTiers: tierList(fd, "ticket_tiers"),
    eventLeadId: int(fd, "event_lead_id"),
    committee: str(fd, "committee"),
    dusaSubmissionStatus: str(fd, "dusa_submission_status"),
    dusaDeadline: str(fd, "dusa_deadline"),
    dusaRequired: bool(fd, "dusa_required"),
    foodProvided: bool(fd, "food_provided"),
    externalGuests: bool(fd, "external_guests"),
    expectedAttendance: int(fd, "expected_attendance"),
    actualAttendance: int(fd, "actual_attendance"),
    description: str(fd, "description"),
  };
}

/** Refresh the dashboard's own cached pages. */
function revalidateDashboard() {
  revalidatePath("/events");
  revalidatePath("/events/dusa");
  revalidatePath("/");
}

/**
 * Dashboard + public website. Use for mutations that change what the website
 * shows (create / update / archive / delete); internal-only changes (DUSA
 * pipeline status, review-form link) should call `revalidateDashboard()` so they
 * don't needlessly bust the public cache.
 */
async function revalidateEvents() {
  revalidateDashboard();
  await revalidateWebsite("events");
}

export async function createEvent(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireWrite("events");
  const values = parseEvent(fd);
  if (!values.name) return { error: "Event name is required." };
  const [row] = await db.insert(events).values(values).returning({ id: events.id });
  await revalidateEvents();
  return { ok: true, message: "Event created", undo: createToken("event", row?.id), id: row?.id };
}

export async function updateEvent(
  id: number,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  await requireWrite("events");
  const values = parseEvent(fd);
  if (!values.name) return { error: "Event name is required." };
  const undo = await snapshotForUpdate("event", id);
  await db
    .update(events)
    .set({ ...values, updatedAt: new Date().toISOString() })
    .where(eq(events.id, id));
  await revalidateEvents();
  return { ok: true, message: "Event updated", undo };
}

/**
 * Toggle an event between draft and published. Publishing reveals it on the
 * public website (the dsec-api /website/events feed filters is_public); a draft
 * lives only in the dashboard. Publishing is gated on the essentials being
 * filled in so a half-created event can't go live. Reversible via undo.
 */
export async function setEventPublished(id: number, published: boolean): Promise<FormState> {
  await requireWrite("events");
  if (published) {
    const [e] = await db
      .select({ name: events.name, startDate: events.startDate })
      .from(events)
      .where(eq(events.id, id))
      .limit(1);
    if (!e) return { error: "Event not found." };
    if (!e.name || !e.startDate) {
      return { error: "Add a name and start date before publishing." };
    }
  }
  const undo = await snapshotForUpdate("event", id);
  await db
    .update(events)
    .set({ isPublic: published, updatedAt: new Date().toISOString() })
    .where(eq(events.id, id));
  await revalidateEvents();
  return { ok: true, message: published ? "Event published" : "Moved to draft", undo };
}

export async function archiveEvent(id: number): Promise<FormState> {
  await requireWrite("events");
  await db
    .update(events)
    .set({ archived: true, updatedAt: new Date().toISOString() })
    .where(eq(events.id, id));
  await revalidateEvents();
  return {
    ok: true,
    message: "Event archived",
    undo: archiveToken("event", id),
  };
}

export async function deleteEvent(id: number): Promise<FormState> {
  await requireWrite("events");
  // Snapshot the row before it's gone so the toast can offer "Undo" (re-insert).
  const undo = await snapshotForDelete("event", id);
  // finance.related_event_id references events.id with no ON DELETE rule, so we
  // must unlink any finance rows before the delete or Postgres rejects it.
  // (Those links are NOT restored on undo — see undo-feature notes.)
  await db.transaction(async (tx) => {
    await tx
      .update(finance)
      .set({ relatedEventId: null, updatedAt: new Date().toISOString() })
      .where(eq(finance.relatedEventId, id));
    await tx.delete(events).where(eq(events.id, id));
  });
  await revalidateEvents();
  return { ok: true, message: "Event deleted", undo };
}

/**
 * Create a Tally post-event review form for an event. The dsec-api owns the
 * Tally key and the question template; this just calls it and revalidates so the
 * stored form link (events.review_form_url) shows up on the page. Idempotent on
 * the API side — calling again returns the existing form.
 */
export async function createReviewForm(eventId: number): Promise<FormState> {
  await requireWrite("events");
  const env = apiEnv();
  if (!env) {
    return {
      error:
        "Review forms need DSEC_API_URL and a write-scoped DSEC_API_KEY set in the dashboard env.",
    };
  }
  try {
    const res = await fetch(`${env.base}/events-api/${eventId}/review-form`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.key}` },
    });
    if (!res.ok) {
      const detail = await res.text();
      return { error: `Couldn't create the form (${res.status}): ${detail.slice(0, 200)}` };
    }
  } catch (e) {
    return { error: `Could not reach the API: ${(e as Error).message}` };
  }
  revalidatePath(`/events/${eventId}/edit`);
  revalidateDashboard();
  return { ok: true, message: "Review form created" };
}

/** Move a single event between DUSA pipeline columns (drag-and-drop). */
export async function updateDusaStatus(
  id: number,
  status: string,
): Promise<FormState> {
  await requireWrite("events");
  if (!DUSA_STATUSES.includes(status as (typeof DUSA_STATUSES)[number])) {
    return { error: "Invalid DUSA status." };
  }
  await db
    .update(events)
    .set({ dusaSubmissionStatus: status, updatedAt: new Date().toISOString() })
    .where(eq(events.id, id));
  revalidateDashboard();
  return { ok: true };
}
