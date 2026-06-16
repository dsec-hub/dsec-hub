"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { finance } from "@/db/schema";
import { requireWrite } from "@/lib/dal";
import { bool, int, num, str } from "@/lib/form-data";
import { archiveToken, createToken, snapshotForDelete, snapshotForUpdate } from "@/lib/undo";
import type { ActionResult } from "@/lib/undo-types";

export type FormState = ActionResult;

function parseFinance(fd: FormData) {
  return {
    item: str(fd, "item") ?? "",
    type: str(fd, "type"),
    amountAud: num(fd, "amount_aud"),
    gstIncluded: bool(fd, "gst_included"),
    status: str(fd, "status"),
    dateRequested: str(fd, "date_requested"),
    datePaid: str(fd, "date_paid"),
    relatedEventId: int(fd, "related_event_id"),
    notes: str(fd, "notes"),
  };
}

function revalidateFinance() {
  revalidatePath("/finance");
  revalidatePath("/");
}

export async function createFinance(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireWrite("finance");
  const values = parseFinance(fd);
  if (!values.item) return { error: "Item is required." };
  const [row] = await db.insert(finance).values(values).returning({ id: finance.id });
  revalidateFinance();
  return { ok: true, message: "Finance entry created", undo: createToken("finance", row?.id) };
}

export async function updateFinance(
  id: number,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  await requireWrite("finance");
  const values = parseFinance(fd);
  if (!values.item) return { error: "Item is required." };
  const undo = await snapshotForUpdate("finance", id);
  await db
    .update(finance)
    .set({ ...values, updatedAt: new Date().toISOString() })
    .where(eq(finance.id, id));
  revalidateFinance();
  return { ok: true, message: "Finance entry updated", undo };
}

export async function archiveFinance(id: number): Promise<FormState> {
  await requireWrite("finance");
  await db
    .update(finance)
    .set({ archived: true, updatedAt: new Date().toISOString() })
    .where(eq(finance.id, id));
  revalidateFinance();
  return {
    ok: true,
    message: "Finance entry archived",
    undo: archiveToken("finance", id),
  };
}

export async function deleteFinance(id: number): Promise<FormState> {
  await requireWrite("finance");
  const undo = await snapshotForDelete("finance", id);
  await db.delete(finance).where(eq(finance.id, id));
  revalidateFinance();
  return { ok: true, message: "Finance entry deleted", undo };
}
