/**
 * Canonical types for the Tasks Views engine.
 *
 * A "view" is a saved or built-in lens over the single task pool: a set of
 * filters + a grouping + a sort + a render mode. Pure types only (no imports,
 * no runtime) so this module is safe to import from edge-safe code, the Drizzle
 * schema (`db/schema.ts` types the `task_view.config` column with `ViewConfigTV`),
 * server helpers, and client components alike.
 *
 * Two distinct config shapes exist in this codebase — do NOT confuse them:
 *   • `ViewConfig`   (db/schema.ts)  → per-ROLE dashboard/focus config.
 *   • `ViewConfigTV` (this file)     → per-VIEW task filter/group/sort/mode.
 */

/** How the task list/board is grouped into sections or columns. */
export type TaskGroupBy =
  | "none"
  | "status"
  | "committee"
  | "board"
  | "related" // related event/project/sponsor
  | "assignee"
  | "due"
  | "priority";

/** Sort key within a group. */
export type TaskSortKey = "due" | "priority" | "created" | "updated" | "title";

export type SortDir = "asc" | "desc";

/** Render mode. Board = kanban (only valid when grouping by status or none). */
export type TaskViewMode = "board" | "list";

/** Coarse due-date bucket used by the "due" filter and "due" grouping. */
export type DueBucket = "overdue" | "today" | "week" | "twoweeks" | "none";

/**
 * The active filter set. All fields optional / nullable = "no constraint".
 * `assignee: "me"` resolves to the current user's personId at query time
 * (dropped with a warning if the user has no linked person).
 */
export type TaskFilter = {
  committee?: string | null;
  assignee?: number | "me" | null;
  boardId?: number | "inbox" | null;
  relatedEventId?: number | null;
  relatedProjectId?: number | null;
  relatedSponsorId?: number | null;
  status?: string | null;
  priority?: string | null;
  due?: DueBucket | null;
  /** Free-text title/description match. */
  search?: string | null;
  /** Hide subtasks (parent_task_id set) from top-level lists/boards. Default true. */
  hideSubtasks?: boolean;
};

/** The full per-view configuration persisted in `task_view.config`. */
export type ViewConfigTV = {
  filter: TaskFilter;
  groupBy: TaskGroupBy;
  sort: { key: TaskSortKey; dir: SortDir };
  mode: TaskViewMode;
};

/** A user-saved view row (mirrors `task_view`). */
export type SavedView = {
  id: number;
  name: string;
  description?: string | null;
  config: ViewConfigTV;
  sortOrder: number;
};

/**
 * A task enriched with everything the views engine filters/groups/sorts on.
 * Returned by `getTasksForViews`; consumed by the pure helpers + client UI.
 */
export type TaskRow = {
  id: number;
  title: string;
  description: string | null;
  status: string;
  position: number;
  priority: string | null;
  dueDate: string | null;
  committee: string | null;
  completedAt: string | null;
  assigneeId: number | null;
  assigneeName: string | null;
  boardId: number | null;
  boardName: string | null;
  parentTaskId: number | null;
  /** Subtask progress (computed): children done / total. 0/0 = no subtasks. */
  subtaskTotal: number;
  subtaskDone: number;
  relatedEventId: number | null;
  relatedEventName: string | null;
  relatedProjectId: number | null;
  relatedProjectName: string | null;
  relatedSponsorId: number | null;
  relatedSponsorName: string | null;
};

/** Stable keys for the built-in (non-saved) views. Stored as strings in role config. */
export type BuiltInViewKey =
  | "my-work"
  | "all-tasks"
  | "by-committee"
  | "by-event"
  | "by-board";

export const BUILT_IN_VIEW_KEYS: readonly BuiltInViewKey[] = [
  "my-work",
  "all-tasks",
  "by-committee",
  "by-event",
  "by-board",
] as const;

export function isBuiltInViewKey(v: string | null | undefined): v is BuiltInViewKey {
  return !!v && (BUILT_IN_VIEW_KEYS as readonly string[]).includes(v);
}
