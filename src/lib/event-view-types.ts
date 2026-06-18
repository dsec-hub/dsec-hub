/**
 * Canonical types for the Events Views engine.
 *
 * A "view" is a saved or built-in lens over the events pool: a set of filters +
 * a grouping + a sort + a render mode (list or calendar). Pure types only (no
 * imports, no runtime) so this module is safe to import from the Drizzle schema
 * (`db/schema.ts` types the `event_view.config` column with `ViewConfigEV`),
 * server helpers, and client components alike.
 *
 * Mirrors lib/task-view-types.ts. Three distinct config shapes exist in this
 * codebase — do NOT confuse them:
 *   • `ViewConfig`   (db/schema.ts)        → per-ROLE dashboard/focus config.
 *   • `ViewConfigTV` (lib/task-view-types) → per-VIEW task lens.
 *   • `ViewConfigEV` (this file)           → per-VIEW event lens.
 */

/** How the events list is grouped into sections. `cluster` is special: it
 * groups events by connected component over the event_connection graph, so a
 * linked "series" of events sits together. */
export type EventGroupBy =
  | "none"
  | "cluster"
  | "status"
  | "type"
  | "committee"
  | "lead"
  | "format"
  | "month"
  | "trimester"
  | "dusa";

/** One symmetric event-to-event link (mirrors a row in `event_connection`). */
export type EventEdge = { eventAId: number; eventBId: number; label: string | null };

/** Sort key within a group. */
export type EventSortKey = "date" | "name" | "status" | "created" | "attendance";

export type SortDir = "asc" | "desc";

/** Render mode. Calendar reuses the existing month/week/day grid. */
export type EventViewMode = "list" | "calendar";

/** Coarse start-date bucket used by the "date" filter. */
export type EventDateBucket = "upcoming" | "thisweek" | "thismonth" | "past" | "undated";

/**
 * The active filter set. All fields optional / nullable = "no constraint".
 * `leadId: "me"` resolves to the current user's personId at query time
 * (matches nothing if the viewer has no linked person).
 */
export type EventFilter = {
  status?: string | null;
  type?: string | null;
  committee?: string | null;
  leadId?: number | "me" | null;
  format?: string | null;
  dusa?: string | null;
  /** Coarse start-date window. */
  date?: EventDateBucket | null;
  /** Publish state on the public website. */
  published?: "published" | "draft" | null;
  /** Free-text name/description match. */
  search?: string | null;
};

/** The full per-view configuration persisted in `event_view.config`. */
export type ViewConfigEV = {
  filter: EventFilter;
  groupBy: EventGroupBy;
  sort: { key: EventSortKey; dir: SortDir };
  mode: EventViewMode;
};

/** A user-saved view row (mirrors `event_view`). */
export type SavedEventView = {
  id: number;
  name: string;
  description?: string | null;
  config: ViewConfigEV;
  sortOrder: number;
};

/** Stable keys for the built-in (non-saved) views. */
export type BuiltInEventViewKey =
  | "all"
  | "my-events"
  | "upcoming"
  | "past"
  | "drafts"
  | "by-committee"
  | "related"
  | "calendar";

export const BUILT_IN_EVENT_VIEW_KEYS: readonly BuiltInEventViewKey[] = [
  "all",
  "my-events",
  "upcoming",
  "past",
  "drafts",
  "by-committee",
  "related",
  "calendar",
] as const;

export function isBuiltInEventViewKey(v: string | null | undefined): v is BuiltInEventViewKey {
  return !!v && (BUILT_IN_EVENT_VIEW_KEYS as readonly string[]).includes(v);
}
