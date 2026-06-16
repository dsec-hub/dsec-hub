"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { sponsorLeads } from "@/db/schema";
import { requireWrite } from "@/lib/dal";
import { str } from "@/lib/form-data";
import type { ActionResult } from "@/lib/undo-types";

export type FormState = ActionResult;

const VALID_STATUSES = new Set(["new", "contacted", "converted", "closed"]);

function revalidate() {
  revalidatePath("/sponsors/leads");
  revalidatePath("/sponsors");
}

export async function updateLeadStatus(
  id: number,
  status: string,
): Promise<FormState> {
  await requireWrite("sponsors");
  if (!VALID_STATUSES.has(status)) return { error: "Invalid status." };
  await db
    .update(sponsorLeads)
    .set({ status, updatedAt: new Date().toISOString() })
    .where(eq(sponsorLeads.id, id));
  revalidate();
  return { ok: true };
}

export async function updateLeadNotes(
  id: number,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  await requireWrite("sponsors");
  const notes = str(fd, "notes");
  await db
    .update(sponsorLeads)
    .set({ notes, updatedAt: new Date().toISOString() })
    .where(eq(sponsorLeads.id, id));
  revalidate();
  return { ok: true, message: "Notes saved." };
}
