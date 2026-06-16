"use server";

import { revalidatePath } from "next/cache";
import { inArray } from "drizzle-orm";

import { db } from "@/db";
import { appSetting } from "@/db/schema";
import { requireAdmin } from "@/lib/dal";
import { str } from "@/lib/form-data";
import { SITE_LINK_KEYS } from "@/lib/site-settings";
import { signToken } from "@/lib/undo-sign";
import type { ActionResult } from "@/lib/undo-types";

export type FormState = ActionResult;

/** Update the global public social/contact links. Admins only. */
export async function updateSiteLinks(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();

  // Snapshot the current values of every link key so the whole save is undoable
  // (these rows have no serial id, so they use a dedicated "settings" token).
  const existing = await db
    .select()
    .from(appSetting)
    .where(inArray(appSetting.key, [...SITE_LINK_KEYS]));
  const prev: Record<string, string | null> = {};
  for (const key of SITE_LINK_KEYS) {
    prev[key] = existing.find((r) => r.key === key)?.value ?? null;
  }

  for (const key of SITE_LINK_KEYS) {
    const value = str(fd, key); // empty input → null (link cleared)
    await db
      .insert(appSetting)
      .values({ key, value })
      .onConflictDoUpdate({
        target: appSetting.key,
        set: { value, updatedAt: new Date().toISOString() },
      });
  }

  revalidatePath("/admin/links");
  return {
    ok: true,
    message: "Links updated",
    undo: signToken({ op: "settings", prev, paths: ["/admin/links"] }),
  };
}
