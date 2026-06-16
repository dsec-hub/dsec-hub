"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { eventConnections, eventPartners, eventSpeakers, eventSponsors } from "@/db/workspace-schema";
import { requireWrite } from "@/lib/dal";
import { int, str } from "@/lib/form-data";
import { createToken, snapshotForDelete, snapshotForUpdate } from "@/lib/undo";
import type { ActionResult } from "@/lib/undo-types";
import { logMutation } from "@/lib/usage";

export type FormState = ActionResult;

function revalidateEvent(eventId: number) {
  revalidatePath(`/events/${eventId}/edit`);
  revalidatePath("/events");
}

// --- Event speakers --------------------------------------------------------
// A speaker is either a linked person (autofills the name) or a free-text guest.
// The headshot is uploaded separately via the MediaManager (entity "speaker").

export async function createEventSpeaker(
  eventId: number,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const user = await requireWrite("events");
  const personId = int(fd, "person_id");
  const name = str(fd, "name");
  if (!personId && !name) return { error: "Pick a person or type a speaker name." };
  const [row] = await db
    .insert(eventSpeakers)
    .values({
      eventId,
      personId,
      name,
      title: str(fd, "title"),
      bio: str(fd, "bio"),
    })
    .returning({ id: eventSpeakers.id });
  await logMutation(user, "create", "event-speaker", row?.id);
  revalidateEvent(eventId);
  return { ok: true, message: "Speaker added", undo: createToken("event_speaker", row?.id) };
}

export async function updateEventSpeaker(
  speakerId: number,
  eventId: number,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const user = await requireWrite("events");
  const personId = int(fd, "person_id");
  const name = str(fd, "name");
  if (!personId && !name) return { error: "Pick a person or type a speaker name." };
  const undo = await snapshotForUpdate("event_speaker", speakerId);
  await db
    .update(eventSpeakers)
    .set({
      personId,
      name,
      title: str(fd, "title"),
      bio: str(fd, "bio"),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(eventSpeakers.id, speakerId));
  await logMutation(user, "update", "event-speaker", speakerId);
  revalidateEvent(eventId);
  return { ok: true, message: "Speaker updated", undo };
}

export async function deleteEventSpeaker(
  speakerId: number,
  eventId: number,
): Promise<FormState> {
  const user = await requireWrite("events");
  // Snapshot before delete so Undo re-inserts the row with the SAME id — which
  // re-links any uploaded headshot (media keyed by speaker id). The Supabase
  // photo objects are intentionally left in place for exactly this reason.
  const undo = await snapshotForDelete("event_speaker", speakerId);
  await db.delete(eventSpeakers).where(eq(eventSpeakers.id, speakerId));
  await logMutation(user, "delete", "event-speaker", speakerId);
  revalidateEvent(eventId);
  return { ok: true, message: "Speaker removed", undo };
}

// --- Event sponsors --------------------------------------------------------
// Links an existing sponsor to this event (many-to-many). The logo lives on the
// sponsor and is reused across events.

export async function addEventSponsor(
  eventId: number,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const user = await requireWrite("events");
  const sponsorId = int(fd, "sponsor_id");
  if (!sponsorId) return { error: "Pick a sponsor to add." };
  const existing = await db
    .select({ id: eventSponsors.id })
    .from(eventSponsors)
    .where(and(eq(eventSponsors.eventId, eventId), eq(eventSponsors.sponsorId, sponsorId)))
    .limit(1);
  if (existing.length) return { error: "That sponsor is already linked to this event." };
  const [row] = await db
    .insert(eventSponsors)
    .values({ eventId, sponsorId, tier: str(fd, "tier") })
    .returning({ id: eventSponsors.id });
  await logMutation(user, "create", "event-sponsor", row?.id);
  revalidateEvent(eventId);
  return { ok: true, message: "Sponsor linked", undo: createToken("event_sponsor", row?.id) };
}

export async function removeEventSponsor(
  linkId: number,
  eventId: number,
): Promise<FormState> {
  const user = await requireWrite("events");
  const undo = await snapshotForDelete("event_sponsor", linkId);
  await db.delete(eventSponsors).where(eq(eventSponsors.id, linkId));
  await logMutation(user, "delete", "event-sponsor", linkId);
  revalidateEvent(eventId);
  return { ok: true, message: "Sponsor unlinked", undo };
}

// --- Event partners --------------------------------------------------------
// Links an existing partner (collaborator club) to this event (many-to-many).
// The logo lives on the partner and is reused across events. Gated by the
// events module — same as sponsors — since it edits the event's collaborators.

export async function addEventPartner(
  eventId: number,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const user = await requireWrite("events");
  const partnerId = int(fd, "partner_id");
  if (!partnerId) return { error: "Pick a partner to add." };
  const existing = await db
    .select({ id: eventPartners.id })
    .from(eventPartners)
    .where(and(eq(eventPartners.eventId, eventId), eq(eventPartners.partnerId, partnerId)))
    .limit(1);
  if (existing.length) return { error: "That partner is already linked to this event." };
  const [row] = await db
    .insert(eventPartners)
    .values({ eventId, partnerId, role: str(fd, "role") })
    .returning({ id: eventPartners.id });
  await logMutation(user, "create", "event-partner", row?.id);
  revalidateEvent(eventId);
  return { ok: true, message: "Partner linked", undo: createToken("event_partner", row?.id) };
}

export async function removeEventPartner(
  linkId: number,
  eventId: number,
): Promise<FormState> {
  const user = await requireWrite("events");
  const undo = await snapshotForDelete("event_partner", linkId);
  await db.delete(eventPartners).where(eq(eventPartners.id, linkId));
  await logMutation(user, "delete", "event-partner", linkId);
  revalidateEvent(eventId);
  return { ok: true, message: "Partner unlinked", undo };
}

// --- Event connections -----------------------------------------------------
// Symmetric, visual-only links between two events ("these events are related").
// Stored canonically (smaller id first) so a pair has exactly one row regardless
// of which event it was added from. Hard-deleted on remove (like sponsors) so
// the pair can be re-linked later. Gated by the events module.

export async function addEventConnection(
  eventId: number,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const user = await requireWrite("events");
  const otherId = int(fd, "other_event_id");
  if (!otherId) return { error: "Pick an event to connect." };
  if (otherId === eventId) return { error: "An event can't be connected to itself." };
  // Canonical ordering: smaller id is always eventAId, so the pair is unique.
  const a = Math.min(eventId, otherId);
  const b = Math.max(eventId, otherId);
  const existing = await db
    .select({ id: eventConnections.id })
    .from(eventConnections)
    .where(and(eq(eventConnections.eventAId, a), eq(eventConnections.eventBId, b)))
    .limit(1);
  if (existing.length) return { error: "These events are already connected." };
  const [row] = await db
    .insert(eventConnections)
    .values({ eventAId: a, eventBId: b, label: str(fd, "label") })
    .returning({ id: eventConnections.id });
  await logMutation(user, "create", "event-connection", row?.id);
  revalidateEvent(eventId);
  return { ok: true, message: "Events connected", undo: createToken("event_connection", row?.id) };
}

export async function removeEventConnection(
  linkId: number,
  eventId: number,
): Promise<FormState> {
  const user = await requireWrite("events");
  const undo = await snapshotForDelete("event_connection", linkId);
  await db.delete(eventConnections).where(eq(eventConnections.id, linkId));
  await logMutation(user, "delete", "event-connection", linkId);
  revalidateEvent(eventId);
  return { ok: true, message: "Connection removed", undo };
}
