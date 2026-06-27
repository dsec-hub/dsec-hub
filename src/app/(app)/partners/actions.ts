"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { partners } from "@/db/workspace-schema";
import { requireWrite } from "@/lib/dal";
import { bool, str } from "@/lib/form-data";
import { revalidateWebsite } from "@/lib/revalidate-website";
import { archiveToken, createToken, snapshotForDelete, snapshotForUpdate } from "@/lib/undo";
import type { ActionResult } from "@/lib/undo-types";
import { logMutation } from "@/lib/usage";

export type FormState = ActionResult;

const PARTNER_STATUS_SET = new Set(["lead", "contacted", "active", "inactive"]);

function parsePartner(fd: FormData) {
  const status = str(fd, "status");
  return {
    name: str(fd, "name") ?? "",
    website: str(fd, "website"),
    email: str(fd, "email"),
    instagram: str(fd, "instagram"),
    linkedin: str(fd, "linkedin"),
    facebook: str(fd, "facebook"),
    notes: str(fd, "notes"),
    status: status && PARTNER_STATUS_SET.has(status) ? status : "lead",
    showOnWebsite: bool(fd, "show_on_website"),
  };
}

// Published partners surface on the public site's "clubs & partners" wall
// (/about), so refresh that feed as well as the dashboard routes.
async function revalidatePartners() {
  revalidatePath("/partners");
  revalidatePath("/");
  await revalidateWebsite("partners");
}

export async function createPartner(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireWrite("partners");
  const values = parsePartner(fd);
  if (!values.name) return { error: "Name is required." };
  const [row] = await db.insert(partners).values(values).returning({ id: partners.id });
  await logMutation(user, "create", "partner", row?.id);
  await revalidatePartners();
  return { ok: true, message: "Partner created", undo: createToken("partner", row?.id), id: row?.id };
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
  await revalidatePartners();
  return { ok: true, message: "Partner updated", undo };
}

export async function archivePartner(id: number): Promise<FormState> {
  const user = await requireWrite("partners");
  await db
    .update(partners)
    .set({ archived: true, updatedAt: new Date().toISOString() })
    .where(eq(partners.id, id));
  await logMutation(user, "archive", "partner", id);
  await revalidatePartners();
  return { ok: true, message: "Partner archived", undo: archiveToken("partner", id) };
}

export async function deletePartner(id: number): Promise<FormState> {
  const user = await requireWrite("partners");
  const undo = await snapshotForDelete("partner", id);
  await db.delete(partners).where(eq(partners.id, id));
  await logMutation(user, "delete", "partner", id);
  await revalidatePartners();
  return { ok: true, message: "Partner deleted", undo };
}
