"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { meetings, type AgendaItem } from "@/db/workspace-schema";
import { requireWrite, type CurrentUser } from "@/lib/dal";
import { canWriteCommittee } from "@/lib/rbac";
import { str } from "@/lib/form-data";
import { logMutation } from "@/lib/usage";

export type FormState = { error?: string; ok?: boolean } | undefined;

const MAX_ITEMS = 100;
const MAX_DURATION = 24 * 60; // a day, in minutes

function toIntOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

/** Like toIntOrNull but allows 0 (a "0 min" agenda item is valid — the API
 * schema is ge=0), and clamps to the upper bound. */
function toDurationOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(Math.floor(n), MAX_DURATION);
}

/** Coerce the client's JSON into the canonical stored shape: drop blank-title
 * rows, assign a stable id to new items, renumber `order` to list position, and
 * clamp durations. Never trusts the client's `order`/`id` blindly. */
function normaliseItems(raw: unknown): AgendaItem[] {
  if (!Array.isArray(raw)) return [];
  const out: AgendaItem[] = [];
  for (const r of raw.slice(0, MAX_ITEMS)) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const title = typeof o.title === "string" ? o.title.trim() : "";
    if (!title) continue; // a row with no title isn't an agenda item
    const id =
      typeof o.id === "string" && o.id.trim() ? o.id.trim() : randomBytes(8).toString("hex");
    const notes = typeof o.notes === "string" && o.notes.trim() ? o.notes.trim() : null;
    out.push({
      id,
      order: out.length,
      title: title.slice(0, 512),
      owner_person_id: toIntOrNull(o.owner_person_id),
      duration_minutes: toDurationOrNull(o.duration_minutes),
      notes,
      related_task_id: toIntOrNull(o.related_task_id),
      related_event_id: toIntOrNull(o.related_event_id),
    });
  }
  return out;
}

/** Load the meeting's committee + agenda state, and bounce own-scope users who
 * can't write its committee (defense-in-depth against forged POSTs). */
async function loadWritable(user: CurrentUser, id: number) {
  const [existing] = await db
    .select({
      committee: meetings.committee,
      agendaStatus: meetings.agendaStatus,
      agendaShareToken: meetings.agendaShareToken,
      agendaSharedAt: meetings.agendaSharedAt,
    })
    .from(meetings)
    .where(eq(meetings.id, id))
    .limit(1);
  if (!existing) return null;
  if (!canWriteCommittee(user.viewConfig.committeeScope, user.userCommittee, existing.committee)) {
    redirect("/meetings");
  }
  return existing;
}

function revalidateAgenda(id: number, token?: string | null) {
  revalidatePath(`/meetings/${id}/agenda`);
  revalidatePath(`/meetings/${id}`);
  if (token) revalidatePath(`/agenda/${token}`);
}

/** Replace the meeting's full agenda item list. */
export async function saveAgenda(
  meetingId: number,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const user = await requireWrite("meetings");
  const existing = await loadWritable(user, meetingId);
  if (!existing) return { error: "Meeting not found." };
  if (existing.agendaStatus === "locked") {
    return { error: "This agenda is locked and can no longer be edited." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(str(fd, "items") ?? "[]");
  } catch {
    return { error: "Could not read the agenda — please try again." };
  }
  const items = normaliseItems(parsed);

  await db
    .update(meetings)
    .set({ agendaItems: items, updatedAt: new Date().toISOString() })
    .where(eq(meetings.id, meetingId));
  await logMutation(user, "update", "meeting_agenda", meetingId, `${items.length} items`);
  revalidateAgenda(meetingId, existing.agendaShareToken);
  return { ok: true };
}

/** Share the agenda with invitees: mint a stable token (once) and mark it
 * shared. Idempotent — re-sharing keeps the same link. */
export async function shareAgenda(meetingId: number): Promise<void> {
  const user = await requireWrite("meetings");
  const existing = await loadWritable(user, meetingId);
  if (!existing) redirect("/meetings");

  const token = existing.agendaShareToken ?? randomBytes(24).toString("base64url");
  await db
    .update(meetings)
    .set({
      // A locked agenda stays locked; otherwise sharing makes it public.
      agendaStatus: existing.agendaStatus === "locked" ? "locked" : "shared",
      agendaShareToken: token,
      agendaSharedAt: existing.agendaSharedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(meetings.id, meetingId));
  await logMutation(user, "update", "meeting_agenda", meetingId, "shared");
  revalidateAgenda(meetingId, token);
}

/** Freeze the agenda once the meeting starts (still viewable, no longer editable). */
export async function lockAgenda(meetingId: number): Promise<void> {
  const user = await requireWrite("meetings");
  const existing = await loadWritable(user, meetingId);
  if (!existing) redirect("/meetings");

  await db
    .update(meetings)
    .set({ agendaStatus: "locked", updatedAt: new Date().toISOString() })
    .where(eq(meetings.id, meetingId));
  await logMutation(user, "update", "meeting_agenda", meetingId, "locked");
  revalidateAgenda(meetingId, existing.agendaShareToken);
}
