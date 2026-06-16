"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { events } from "@/db/workspace-schema";
import { requireWrite } from "@/lib/dal";
import { int, num } from "@/lib/form-data";
import { logMutation } from "@/lib/usage";

export type BudgetState = { error?: string; ok?: string } | undefined;

/** Set an event's budget; auto-applies a 50% DUSA grant. Finance module only. */
export async function setEventBudget(_prev: BudgetState, fd: FormData): Promise<BudgetState> {
  const user = await requireWrite("finance");
  const eventId = int(fd, "event_id");
  const budget = num(fd, "budget_aud"); // string (numeric col) or null
  if (!eventId) return { error: "Pick an event." };
  if (budget === null) return { error: "Enter a budget amount." };

  const grant = (Number(budget) * 0.5).toFixed(2);
  await db
    .update(events)
    .set({ budgetAud: budget, grantAud: grant, updatedAt: new Date().toISOString() })
    .where(eq(events.id, eventId));
  await logMutation(user, "update", "event-budget", eventId, `budget ${budget}`);
  revalidatePath("/dashboard");
  return { ok: `Budget set — 50% grant ($${grant}) auto-applied.` };
}
