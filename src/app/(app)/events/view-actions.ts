"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { appEventView } from "@/db/schema";
import { requireModule } from "@/lib/dal";
import { sanitizeEventViewConfig } from "@/lib/event-view-helpers";
import { nextSavedEventViewOrder } from "@/lib/event-view-queries";
import type { ViewConfigEV } from "@/lib/event-view-types";
import type { ActionResult } from "@/lib/undo-types";

export type EventViewActionState = ActionResult & { viewId?: number };

/** Personal saved views need only event READ access (they're a per-user pref). */
async function requireEventReaderId(): Promise<number> {
  const user = await requireModule("events");
  return user.id;
}

export async function createSavedEventView(
  name: string,
  config: ViewConfigEV,
): Promise<EventViewActionState> {
  const userId = await requireEventReaderId();
  const clean = (name ?? "").trim().slice(0, 128);
  if (!clean) return { error: "Give the view a name." };
  const order = await nextSavedEventViewOrder(userId);
  try {
    const [row] = await db
      .insert(appEventView)
      .values({ userId, name: clean, config: sanitizeEventViewConfig(config), sortOrder: order })
      .returning({ id: appEventView.id });
    revalidatePath("/events");
    return { ok: true, message: "View saved", viewId: row?.id };
  } catch {
    // The partial unique index (user_id, lower(name)) makes a dup name throw.
    return { error: "You already have a view with that name." };
  }
}

export async function updateSavedEventView(
  id: number,
  patch: { name?: string; config?: ViewConfigEV },
): Promise<EventViewActionState> {
  const userId = await requireEventReaderId();
  const [own] = await db
    .select({ id: appEventView.id })
    .from(appEventView)
    .where(and(eq(appEventView.id, id), eq(appEventView.userId, userId)))
    .limit(1);
  if (!own) return { error: "View not found." };

  const set: Partial<typeof appEventView.$inferInsert> = { updatedAt: new Date().toISOString() };
  if (patch.name != null) {
    const clean = patch.name.trim().slice(0, 128);
    if (!clean) return { error: "Give the view a name." };
    set.name = clean;
  }
  if (patch.config != null) set.config = sanitizeEventViewConfig(patch.config);

  await db.update(appEventView).set(set).where(eq(appEventView.id, id));
  revalidatePath("/events");
  return { ok: true, message: "View updated", viewId: id };
}

export async function deleteSavedEventView(id: number): Promise<EventViewActionState> {
  const userId = await requireEventReaderId();
  await db
    .update(appEventView)
    .set({ archived: true, updatedAt: new Date().toISOString() })
    .where(and(eq(appEventView.id, id), eq(appEventView.userId, userId)));
  revalidatePath("/events");
  return { ok: true, message: "View deleted" };
}
