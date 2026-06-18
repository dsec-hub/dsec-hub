"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { appTaskView } from "@/db/schema";
import { requireModule } from "@/lib/dal";
import { sanitizeViewConfig } from "@/lib/task-view-helpers";
import type { ViewConfigTV } from "@/lib/task-view-types";
import { nextSavedViewOrder } from "@/lib/task-view-queries";
import type { ActionResult } from "@/lib/undo-types";

export type ViewActionState = ActionResult & { viewId?: number };

/** Personal saved views need only task READ access (they're a per-user pref). */
async function requireTaskReaderId(): Promise<number> {
  const user = await requireModule("tasks");
  return user.id;
}

export async function createSavedView(name: string, config: ViewConfigTV): Promise<ViewActionState> {
  const userId = await requireTaskReaderId();
  const clean = (name ?? "").trim().slice(0, 128);
  if (!clean) return { error: "Give the view a name." };
  const order = await nextSavedViewOrder(userId);
  try {
    const [row] = await db
      .insert(appTaskView)
      .values({ userId, name: clean, config: sanitizeViewConfig(config), sortOrder: order })
      .returning({ id: appTaskView.id });
    revalidatePath("/tasks");
    return { ok: true, message: "View saved", viewId: row?.id };
  } catch {
    // The partial unique index (user_id, lower(name)) makes a dup name throw.
    return { error: "You already have a view with that name." };
  }
}

export async function updateSavedView(
  id: number,
  patch: { name?: string; config?: ViewConfigTV },
): Promise<ViewActionState> {
  const userId = await requireTaskReaderId();
  const [own] = await db
    .select({ id: appTaskView.id })
    .from(appTaskView)
    .where(and(eq(appTaskView.id, id), eq(appTaskView.userId, userId)))
    .limit(1);
  if (!own) return { error: "View not found." };

  const set: Partial<typeof appTaskView.$inferInsert> = { updatedAt: new Date().toISOString() };
  if (patch.name != null) {
    const clean = patch.name.trim().slice(0, 128);
    if (!clean) return { error: "Give the view a name." };
    set.name = clean;
  }
  if (patch.config != null) set.config = sanitizeViewConfig(patch.config);

  await db.update(appTaskView).set(set).where(eq(appTaskView.id, id));
  revalidatePath("/tasks");
  return { ok: true, message: "View updated", viewId: id };
}

export async function deleteSavedView(id: number): Promise<ViewActionState> {
  const userId = await requireTaskReaderId();
  await db
    .update(appTaskView)
    .set({ archived: true, updatedAt: new Date().toISOString() })
    .where(and(eq(appTaskView.id, id), eq(appTaskView.userId, userId)));
  revalidatePath("/tasks");
  return { ok: true, message: "View deleted" };
}

export async function reorderSavedViews(orderedIds: number[]): Promise<ViewActionState> {
  const userId = await requireTaskReaderId();
  await Promise.all(
    orderedIds.map((id, i) =>
      db
        .update(appTaskView)
        .set({ sortOrder: i, updatedAt: new Date().toISOString() })
        .where(and(eq(appTaskView.id, id), eq(appTaskView.userId, userId))),
    ),
  );
  revalidatePath("/tasks");
  return { ok: true };
}
