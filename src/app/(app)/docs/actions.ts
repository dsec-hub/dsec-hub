"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { documents } from "@/db/workspace-schema";
import { requireWrite, type CurrentUser } from "@/lib/dal";
import { committeeScopeOf } from "@/lib/scope";
import { canWriteCommittee } from "@/lib/rbac";
import { int, str } from "@/lib/form-data";
import { logMutation } from "@/lib/usage";

export type FormState = { error?: string; ok?: boolean } | undefined;
export type DocumentRow = typeof documents.$inferSelect;

function parseDocument(fd: FormData) {
  return {
    title: str(fd, "title") ?? "",
    type: str(fd, "type"),
    committee: str(fd, "committee"),
    status: str(fd, "status"),
    content: str(fd, "content"),
    assigneeId: int(fd, "assignee_id"),
    relatedEventId: int(fd, "related_event_id"),
    relatedProjectId: int(fd, "related_project_id"),
    relatedMeetingId: int(fd, "related_meeting_id"),
  };
}

/** "all"-scope users save the submitted committee (or club-wide); "own"-scope
 * users are forced to their own committee — never club-wide or another team's. */
function resolveDocCommittee(user: CurrentUser, submitted: string | null): string | null {
  const { all, committee } = committeeScopeOf(user);
  return all ? submitted || null : committee;
}

/** Bounce if the user can't write a doc owned by this committee (scoped guard). */
async function assertCanWriteDoc(user: CurrentUser, id: number): Promise<void> {
  const [existing] = await db
    .select({ committee: documents.committee })
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);
  if (existing && !canWriteCommittee(user.viewConfig.committeeScope, user.userCommittee, existing.committee)) {
    redirect("/docs");
  }
}

function revalidateDocs() {
  revalidatePath("/docs");
  revalidatePath("/dashboard");
}

export async function createDocument(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireWrite("documents");
  const values = parseDocument(fd);
  if (!values.title) return { error: "Title is required." };
  values.committee = resolveDocCommittee(user, values.committee ?? null);
  const [row] = await db
    .insert(documents)
    .values(values)
    .returning({ id: documents.id });
  await logMutation(user, "create", "document", row?.id);
  revalidateDocs();
  redirect("/docs");
}

export async function updateDocument(
  id: number,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const user = await requireWrite("documents");
  await assertCanWriteDoc(user, id);
  const values = parseDocument(fd);
  if (!values.title) return { error: "Title is required." };
  values.committee = resolveDocCommittee(user, values.committee ?? null);
  await db
    .update(documents)
    .set({ ...values, updatedAt: new Date().toISOString() })
    .where(eq(documents.id, id));
  await logMutation(user, "update", "document", id);
  revalidateDocs();
  redirect("/docs");
}

export async function archiveDocument(id: number): Promise<void> {
  const user = await requireWrite("documents");
  await assertCanWriteDoc(user, id);
  await db
    .update(documents)
    .set({ archived: true, updatedAt: new Date().toISOString() })
    .where(eq(documents.id, id));
  await logMutation(user, "archive", "document", id);
  revalidateDocs();
  redirect("/docs");
}

export async function deleteDocument(id: number): Promise<void> {
  const user = await requireWrite("documents");
  await assertCanWriteDoc(user, id);
  await db.delete(documents).where(eq(documents.id, id));
  await logMutation(user, "delete", "document", id);
  revalidateDocs();
  redirect("/docs");
}
