"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { documents, events } from "@/db/workspace-schema";
import { requireWrite, type CurrentUser } from "@/lib/dal";
import { int, str } from "@/lib/form-data";
import { canWriteCommittee } from "@/lib/rbac";
import { committeeScopeOf } from "@/lib/scope";
import { archiveToken, createToken, snapshotForUpdate } from "@/lib/undo";
import type { ActionResult } from "@/lib/undo-types";
import { logMutation } from "@/lib/usage";

export type FormState = ActionResult;

// Docs created/edited inline on an event's detail page. Unlike docs/actions.ts
// (which redirects to /docs), these return an ActionResult so the modal can show
// an undo toast and stay put, and they keep the doc anchored to its event:
// `related_event_id` is set by the action, never the client. Write access is the
// Docs module + the committee guard (same model as the standalone Docs editor).

function revalidateEventDocs(eventId: number) {
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/docs");
  revalidatePath("/dashboard");
}

/** Visibility committee for a new event doc: "all"-scope users inherit the
 * event's committee (the doc belongs to that team; null event = club-wide);
 * "own"-scope users are forced to their own committee — never another team's. */
function resolveDocCommittee(user: CurrentUser, eventCommittee: string | null): string | null {
  const { all, committee } = committeeScopeOf(user);
  return all ? eventCommittee : committee;
}

/** Whether this user may write the doc owned by `id`, by its committee scope.
 * Uses committeeScopeOf so an admin (whose role scope may be "own") still passes. */
async function canWriteDoc(user: CurrentUser, id: number): Promise<boolean> {
  const [existing] = await db
    .select({ committee: documents.committee })
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);
  if (!existing) return false;
  const { all, committee } = committeeScopeOf(user);
  return canWriteCommittee(all ? "all" : "own", committee, existing.committee);
}

export async function createEventDocument(
  eventId: number,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const user = await requireWrite("documents");
  const title = str(fd, "title");
  if (!title) return { error: "Title is required." };
  const [ev] = await db
    .select({ committee: events.committee })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);
  if (!ev) return { error: "Event not found." };
  const [row] = await db
    .insert(documents)
    .values({
      title,
      type: str(fd, "type"),
      status: str(fd, "status"),
      content: str(fd, "content"),
      relatedEventId: eventId,
      relatedTaskId: int(fd, "related_task_id"),
      committee: resolveDocCommittee(user, ev.committee),
    })
    .returning({ id: documents.id });
  await logMutation(user, "create", "document", row?.id);
  revalidateEventDocs(eventId);
  return { ok: true, message: "Document added", undo: createToken("document", row?.id) };
}

export async function updateEventDocument(
  docId: number,
  eventId: number,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const user = await requireWrite("documents");
  if (!(await canWriteDoc(user, docId))) return { error: "You can't edit this document." };
  const title = str(fd, "title");
  if (!title) return { error: "Title is required." };
  const undo = await snapshotForUpdate("document", docId);
  // Leave related_event_id and committee untouched so the doc stays anchored to
  // this event with its existing visibility — only the editable fields change.
  await db
    .update(documents)
    .set({
      title,
      type: str(fd, "type"),
      status: str(fd, "status"),
      content: str(fd, "content"),
      relatedTaskId: int(fd, "related_task_id"),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(documents.id, docId));
  await logMutation(user, "update", "document", docId);
  revalidateEventDocs(eventId);
  return { ok: true, message: "Document updated", undo };
}

export async function archiveEventDocument(
  docId: number,
  eventId: number,
): Promise<FormState> {
  const user = await requireWrite("documents");
  if (!(await canWriteDoc(user, docId))) return { error: "You can't remove this document." };
  // Soft-archive (not a hard delete) so Remove is reversible and the doc keeps
  // its id + links; archiveToken restores archived=false on undo.
  await db
    .update(documents)
    .set({ archived: true, updatedAt: new Date().toISOString() })
    .where(eq(documents.id, docId));
  await logMutation(user, "archive", "document", docId);
  revalidateEventDocs(eventId);
  return { ok: true, message: "Document removed", undo: archiveToken("document", docId) };
}
