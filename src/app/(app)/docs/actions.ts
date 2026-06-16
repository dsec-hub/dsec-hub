"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { documents } from "@/db/workspace-schema";
import { requireWrite } from "@/lib/dal";
import { int, str } from "@/lib/form-data";
import { logMutation } from "@/lib/usage";

export type FormState = { error?: string; ok?: boolean } | undefined;
export type DocumentRow = typeof documents.$inferSelect;

function parseDocument(fd: FormData) {
  return {
    title: str(fd, "title") ?? "",
    type: str(fd, "type"),
    status: str(fd, "status"),
    content: str(fd, "content"),
    assigneeId: int(fd, "assignee_id"),
    relatedEventId: int(fd, "related_event_id"),
    relatedProjectId: int(fd, "related_project_id"),
    relatedMeetingId: int(fd, "related_meeting_id"),
  };
}

function revalidateDocs() {
  revalidatePath("/docs");
  revalidatePath("/dashboard");
}

export async function createDocument(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireWrite("documents");
  const values = parseDocument(fd);
  if (!values.title) return { error: "Title is required." };
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
  const values = parseDocument(fd);
  if (!values.title) return { error: "Title is required." };
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
  await db.delete(documents).where(eq(documents.id, id));
  await logMutation(user, "delete", "document", id);
  revalidateDocs();
  redirect("/docs");
}
