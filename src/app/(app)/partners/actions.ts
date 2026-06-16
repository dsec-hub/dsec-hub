"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { partners } from "@/db/workspace-schema";
import { requireWrite } from "@/lib/dal";
import { bool, str } from "@/lib/form-data";
import { archiveToken, createToken, snapshotForDelete, snapshotForUpdate } from "@/lib/undo";
import type { ActionResult } from "@/lib/undo-types";
import { logMutation } from "@/lib/usage";

export type FormState = ActionResult;

function parsePartner(fd: FormData) {
  return {
    name: str(fd, "name") ?? "",
    website: str(fd, "website"),
    notes: str(fd, "notes"),
    showOnWebsite: bool(fd, "show_on_website"),
  };
}

// Internal-only entity, so no website revalidation — just the dashboard routes.
function revalidatePartners() {
  revalidatePath("/partners");
  revalidatePath("/");
}

export async function createPartner(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireWrite("partners");
  const values = parsePartner(fd);
  if (!values.name) return { error: "Name is required." };
  const [row] = await db.insert(partners).values(values).returning({ id: partners.id });
  await logMutation(user, "create", "partner", row?.id);
  revalidatePartners();
  return { ok: true, message: "Partner created", undo: createToken("partner", row?.id) };
}

export async function updatePartner(
  id: number,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const user = await requireWrite("partners");
  const values = parsePartner(fd);
  if (!values.name) return { error: "Name is required." };
  const undo = await snapshotForUpdate("partner", id);
  await db
    .update(partners)
    .set({ ...values, updatedAt: new Date().toISOString() })
    .where(eq(partners.id, id));
  await logMutation(user, "update", "partner", id);
  revalidatePartners();
  return { ok: true, message: "Partner updated", undo };
}

export async function archivePartner(id: number): Promise<FormState> {
  const user = await requireWrite("partners");
  await db
    .update(partners)
    .set({ archived: true, updatedAt: new Date().toISOString() })
    .where(eq(partners.id, id));
  await logMutation(user, "archive", "partner", id);
  revalidatePartners();
  return { ok: true, message: "Partner archived", undo: archiveToken("partner", id) };
}

export async function deletePartner(id: number): Promise<FormState> {
  const user = await requireWrite("partners");
  const undo = await snapshotForDelete("partner", id);
  await db.delete(partners).where(eq(partners.id, id));
  await logMutation(user, "delete", "partner", id);
  revalidatePartners();
  return { ok: true, message: "Partner deleted", undo };
}
