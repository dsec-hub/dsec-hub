/**
 * Pure logic for the Tasks Views engine: built-in view definitions, and the
 * filter / sort / group functions that turn a flat TaskRow[] into the rendered
 * lens. No DB, no React — unit-testable and runnable on client or server.
 */
import type {
  BuiltInViewKey,
  DueBucket,
  TaskFilter,
  TaskGroupBy,
  TaskRow,
  TaskSortKey,
  ViewConfigTV,
} from "@/lib/task-view-types";

// --- Built-in views ----------------------------------------------------------

export const DEFAULT_VIEW_CONFIG: ViewConfigTV = {
  filter: {},
  groupBy: "status",
  sort: { key: "due", dir: "asc" },
  mode: "list",
};

/** The canonical config for each built-in view. `my-work` uses assignee:"me",
 * resolved to the current person at filter time. */
export function builtInConfig(key: BuiltInViewKey): ViewConfigTV {
  switch (key) {
    case "my-work":
      return { filter: { assignee: "me" }, groupBy: "due", sort: { key: "due", dir: "asc" }, mode: "list" };
    case "all-tasks":
      return { filter: {}, groupBy: "status", sort: { key: "due", dir: "asc" }, mode: "list" };
    case "by-committee":
      return { filter: {}, groupBy: "committee", sort: { key: "due", dir: "asc" }, mode: "list" };
    case "by-event":
      return { filter: {}, groupBy: "related", sort: { key: "due", dir: "asc" }, mode: "list" };
    case "by-board":
      return { filter: {}, groupBy: "status", sort: { key: "due", dir: "asc" }, mode: "board" };
  }
}

export const BUILT_IN_VIEWS: { key: BuiltInViewKey; label: string }[] = [
  { key: "my-work", label: "My Work" },
  { key: "all-tasks", label: "All Tasks" },
  { key: "by-committee", label: "By Committee" },
  { key: "by-event", label: "By Event / Project" },
  { key: "by-board", label: "Boards" },
];

// --- Options for the controls ------------------------------------------------

export const GROUP_BY_OPTIONS: { value: TaskGroupBy; label: string }[] = [
  { value: "none", label: "No grouping" },
  { value: "status", label: "Status" },
  { value: "committee", label: "Committee" },
  { value: "board", label: "Board" },
  { value: "related", label: "Event / Project" },
  { value: "assignee", label: "Assignee" },
  { value: "due", label: "Due date" },
  { value: "priority", label: "Priority" },
];

export const SORT_OPTIONS: { value: TaskSortKey; label: string }[] = [
  { value: "due", label: "Due date" },
  { value: "priority", label: "Priority" },
  { value: "created", label: "Created" },
  { value: "updated", label: "Updated" },
  { value: "title", label: "Title" },
];

export const DUE_OPTIONS: { value: DueBucket; label: string }[] = [
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Due today" },
  { value: "week", label: "Due this week" },
  { value: "twoweeks", label: "Due in 2 weeks" },
  { value: "none", label: "No due date" },
];

const GROUP_KEYS = new Set(GROUP_BY_OPTIONS.map((o) => o.value));
const SORT_KEYS = new Set(SORT_OPTIONS.map((o) => o.value));

/** Clamp arbitrary (e.g. persisted / user-supplied) input into a valid config.
 * Used when loading saved views and before persisting them. */
export function sanitizeViewConfig(raw: unknown): ViewConfigTV {
  const r = (raw ?? {}) as Partial<ViewConfigTV>;
  const groupBy = r.groupBy && GROUP_KEYS.has(r.groupBy) ? r.groupBy : "status";
  const sortKey = r.sort?.key && SORT_KEYS.has(r.sort.key) ? r.sort.key : "due";
  const dir = r.sort?.dir === "desc" ? "desc" : "asc";
  const mode = r.mode === "board" ? "board" : "list";
  const f = (r.filter ?? {}) as TaskFilter;
  const filter: TaskFilter = {
    committee: f.committee ?? null,
    assignee: f.assignee === "me" || typeof f.assignee === "number" ? f.assignee : null,
    boardId: f.boardId === "inbox" || typeof f.boardId === "number" ? f.boardId : null,
    relatedEventId: typeof f.relatedEventId === "number" ? f.relatedEventId : null,
    relatedProjectId: typeof f.relatedProjectId === "number" ? f.relatedProjectId : null,
    relatedSponsorId: typeof f.relatedSponsorId === "number" ? f.relatedSponsorId : null,
    status: typeof f.status === "string" ? f.status : null,
    priority: typeof f.priority === "string" ? f.priority : null,
    due: f.due ?? null,
    search: typeof f.search === "string" ? f.search.slice(0, 200) : null,
    hideSubtasks: f.hideSubtasks ?? undefined,
  };
  return { filter, groupBy, sort: { key: sortKey, dir }, mode };
}

// --- Due-date bucketing ------------------------------------------------------

const DAY = 86_400_000;

/** Classify a task's due date relative to `today` (ISO yyyy-mm-dd). Completed
 * tasks are treated by callers separately; this only reads the date. */
export function dueBucketOf(dueDate: string | null, today: string): DueBucket {
  if (!dueDate) return "none";
  if (dueDate < today) return "overdue";
  if (dueDate === today) return "today";
  const t = Date.parse(today);
  const d = Date.parse(dueDate);
  if (Number.isNaN(t) || Number.isNaN(d)) return "none";
  const days = Math.round((d - t) / DAY);
  if (days <= 7) return "week";
  if (days <= 14) return "twoweeks";
  return "none";
}

/** Ordered due-group buckets for grouping by "due". "later" holds far-future +
 * undated so nothing is hidden. */
const DUE_GROUP_ORDER = ["overdue", "today", "week", "twoweeks", "later"] as const;
type DueGroup = (typeof DUE_GROUP_ORDER)[number];
const DUE_GROUP_LABEL: Record<DueGroup, string> = {
  overdue: "Overdue",
  today: "Today",
  week: "This week",
  twoweeks: "Next 2 weeks",
  later: "Later / no date",
};
function dueGroupOf(dueDate: string | null, today: string): DueGroup {
  const b = dueBucketOf(dueDate, today);
  return b === "none" ? "later" : (b as DueGroup);
}

// --- Filtering ---------------------------------------------------------------

/** Apply a filter to the task pool. `personId` resolves assignee:"me"; if the
 * viewer has no linked person it's dropped (can't match) and a warning logged. */
export function applyFilters(
  tasks: TaskRow[],
  filter: TaskFilter,
  personId: number | null,
  today: string,
): TaskRow[] {
  let assignee = filter.assignee;
  if (assignee === "me") {
    // No linked roster record → "my tasks" is genuinely empty. Use a sentinel
    // that matches nothing, rather than dropping the filter (which would show
    // EVERY task mislabelled as "My Work").
    assignee = personId == null ? -1 : personId;
  }
  const search = filter.search?.trim().toLowerCase();
  // Subtasks live inside their parent's checklist, not the top-level board/list.
  const hideSubtasks = filter.hideSubtasks !== false;

  return tasks.filter((t) => {
    if (hideSubtasks && t.parentTaskId != null) return false;
    if (filter.committee != null && t.committee !== filter.committee) return false;
    if (assignee != null && t.assigneeId !== assignee) return false;
    if (filter.boardId === "inbox") {
      if (t.boardId != null) return false;
    } else if (filter.boardId != null && t.boardId !== filter.boardId) return false;
    if (filter.relatedEventId != null && t.relatedEventId !== filter.relatedEventId) return false;
    if (filter.relatedProjectId != null && t.relatedProjectId !== filter.relatedProjectId) return false;
    if (filter.relatedSponsorId != null && t.relatedSponsorId !== filter.relatedSponsorId) return false;
    if (filter.status != null && t.status !== filter.status) return false;
    if (filter.priority != null && t.priority !== filter.priority) return false;
    if (filter.due != null && dueBucketOf(t.dueDate, today) !== filter.due) return false;
    if (search) {
      const hay = `${t.title} ${t.description ?? ""}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });
}

/** True if the filter constrains anything (drives the "clear filters" affordance). */
export function isFilterActive(filter: TaskFilter): boolean {
  return Boolean(
    filter.committee != null ||
      (filter.assignee != null && filter.assignee !== undefined) ||
      filter.boardId != null ||
      filter.relatedEventId != null ||
      filter.relatedProjectId != null ||
      filter.relatedSponsorId != null ||
      filter.status != null ||
      filter.priority != null ||
      filter.due != null ||
      (filter.search && filter.search.trim()),
  );
}

// --- Sorting -----------------------------------------------------------------

const PRIORITY_RANK: Record<string, number> = { Urgent: 0, High: 1, Medium: 2, Low: 3 };

export function sortTasks(tasks: TaskRow[], sort: { key: TaskSortKey; dir: "asc" | "desc" }): TaskRow[] {
  const dir = sort.dir === "desc" ? -1 : 1;
  const out = [...tasks];
  out.sort((a, b) => {
    let cmp = 0;
    switch (sort.key) {
      case "due":
        // Nulls last regardless of direction.
        if (a.dueDate === b.dueDate) cmp = 0;
        else if (!a.dueDate) return 1;
        else if (!b.dueDate) return -1;
        else cmp = a.dueDate < b.dueDate ? -1 : 1;
        break;
      case "priority":
        cmp = (PRIORITY_RANK[a.priority ?? ""] ?? 9) - (PRIORITY_RANK[b.priority ?? ""] ?? 9);
        break;
      case "title":
        cmp = a.title.localeCompare(b.title);
        break;
      case "created":
      case "updated":
        cmp = a.id - b.id; // id is a monotonic proxy for creation order
        break;
    }
    if (cmp === 0) cmp = a.position - b.position || a.id - b.id;
    return cmp * dir;
  });
  return out;
}

// --- Grouping ----------------------------------------------------------------

export type TaskGroup = { key: string; label: string; tasks: TaskRow[] };

const STATUS_ORDER = ["Backlog", "To Do", "In Progress", "Done"];
const PRIORITY_ORDER = ["Urgent", "High", "Medium", "Low"];
const UNGROUPED = "—";

/** The grouping value for a task on a given axis (used by board reassign too). */
export function groupValue(t: TaskRow, by: TaskGroupBy, today: string): { key: string; label: string } {
  switch (by) {
    case "status":
      return { key: t.status, label: t.status };
    case "committee":
      return t.committee ? { key: t.committee, label: t.committee } : { key: "__none__", label: "No committee" };
    case "board":
      return t.boardId == null
        ? { key: "inbox", label: "Inbox" }
        : { key: String(t.boardId), label: t.boardName ?? `Board ${t.boardId}` };
    case "assignee":
      return t.assigneeId == null
        ? { key: "__none__", label: "Unassigned" }
        : { key: String(t.assigneeId), label: t.assigneeName ?? `Person ${t.assigneeId}` };
    case "priority":
      return t.priority ? { key: t.priority, label: t.priority } : { key: "__none__", label: "No priority" };
    case "due": {
      const g = dueGroupOf(t.dueDate, today);
      return { key: g, label: DUE_GROUP_LABEL[g] };
    }
    case "related": {
      if (t.relatedEventId != null) return { key: `e${t.relatedEventId}`, label: t.relatedEventName ?? "Event" };
      if (t.relatedProjectId != null) return { key: `p${t.relatedProjectId}`, label: t.relatedProjectName ?? "Project" };
      if (t.relatedSponsorId != null) return { key: `s${t.relatedSponsorId}`, label: t.relatedSponsorName ?? "Sponsor" };
      return { key: "__none__", label: "Not linked" };
    }
    case "none":
      return { key: "all", label: UNGROUPED };
  }
}

/** Group tasks for rendering. Preserves the incoming (already-sorted) task order
 * within each group; orders the groups themselves sensibly per axis. */
export function groupTasks(tasks: TaskRow[], by: TaskGroupBy, today: string): TaskGroup[] {
  if (by === "none") return [{ key: "all", label: UNGROUPED, tasks }];

  const map = new Map<string, TaskGroup>();
  for (const t of tasks) {
    const { key, label } = groupValue(t, by, today);
    let g = map.get(key);
    if (!g) {
      g = { key, label, tasks: [] };
      map.set(key, g);
    }
    g.tasks.push(t);
  }
  const groups = [...map.values()];

  const order = (fixed: string[]) => (a: TaskGroup, b: TaskGroup) => {
    const ai = fixed.indexOf(a.label);
    const bi = fixed.indexOf(b.label);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    // push the "none/unassigned" buckets to the end
    if (a.key === "__none__") return 1;
    if (b.key === "__none__") return -1;
    return a.label.localeCompare(b.label);
  };

  switch (by) {
    case "status":
      groups.sort(order(STATUS_ORDER));
      break;
    case "priority":
      groups.sort(order(PRIORITY_ORDER));
      break;
    case "due":
      groups.sort((a, b) => DUE_GROUP_ORDER.indexOf(a.key as DueGroup) - DUE_GROUP_ORDER.indexOf(b.key as DueGroup));
      break;
    default:
      groups.sort(order([]));
  }
  return groups;
}

/** Build columns for the board (kanban) view: groups, but for status grouping
 * always include the canonical columns even when empty. */
export function boardColumns(tasks: TaskRow[], by: TaskGroupBy, today: string): TaskGroup[] {
  const groups = groupTasks(tasks, by, today);
  if (by !== "status") return groups;
  const present = new Map(groups.map((g) => [g.key, g]));
  const out: TaskGroup[] = [];
  for (const name of STATUS_ORDER) out.push(present.get(name) ?? { key: name, label: name, tasks: [] });
  for (const g of groups) if (!STATUS_ORDER.includes(g.key)) out.push(g);
  return out;
}

/** Which group-by axes support drag-to-reassign on the board. */
export const REASSIGNABLE: TaskGroupBy[] = ["status", "committee", "board", "assignee", "priority"];
export function canReassignBy(by: TaskGroupBy): boolean {
  return REASSIGNABLE.includes(by);
}
