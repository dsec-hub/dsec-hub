import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { appEventView } from "@/db/schema";
import { DEFAULT_EVENT_VIEW_CONFIG } from "@/lib/event-view-helpers";
import type { SavedEventView, ViewConfigEV } from "@/lib/event-view-types";

/**
 * Per-user saved Events views. The events pool itself comes from `getEvents`
 * (lib/queries.ts) — a student club's event count is small enough that the
 * filter/group/sort lensing happens client-side. Module gating happens at the
 * page (requireModule "events") BEFORE these are called.
 *
 * Mirrors the saved-view helpers in lib/task-view-queries.ts.
 */

function rowToSavedView(r: {
  id: number;
  name: string;
  description: string | null;
  config: ViewConfigEV | null;
  sortOrder: number;
}): SavedEventView {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    config: r.config && typeof r.config === "object" ? r.config : DEFAULT_EVENT_VIEW_CONFIG,
    sortOrder: r.sortOrder,
  };
}

/** A user's saved event views, in their chosen order. */
export async function getSavedEventViews(userId: number): Promise<SavedEventView[]> {
  const rows = await db
    .select({
      id: appEventView.id,
      name: appEventView.name,
      description: appEventView.description,
      config: appEventView.config,
      sortOrder: appEventView.sortOrder,
    })
    .from(appEventView)
    .where(and(eq(appEventView.userId, userId), eq(appEventView.archived, false)))
    .orderBy(asc(appEventView.sortOrder), asc(appEventView.id));
  return rows.map(rowToSavedView);
}

/** Highest sort_order among a user's views (for appending a new one). */
export async function nextSavedEventViewOrder(userId: number): Promise<number> {
  const [row] = await db
    .select({ sortOrder: appEventView.sortOrder })
    .from(appEventView)
    .where(and(eq(appEventView.userId, userId), eq(appEventView.archived, false)))
    .orderBy(desc(appEventView.sortOrder))
    .limit(1);
  return (row?.sortOrder ?? -1) + 1;
}
