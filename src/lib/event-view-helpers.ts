/**
 * Pure logic for the Events Views engine: built-in view definitions, and the
 * filter / sort / group functions that turn a flat EventWithLead[] into the
 * rendered lens. No DB, no React — runnable on client or server.
 *
 * Mirrors lib/task-view-helpers.ts.
 */
import { DUSA_STATUSES, EVENT_FORMATS, EVENT_STATUSES, EVENT_TYPES } from "@/lib/options";
import type { EventWithLead } from "@/lib/queries";
import type {
  BuiltInEventViewKey,
  EventDateBucket,
  EventEdge,
  EventFilter,
  EventGroupBy,
  EventSortKey,
  SortDir,
  ViewConfigEV,
} from "@/lib/event-view-types";

// --- Built-in views ----------------------------------------------------------

export const DEFAULT_EVENT_VIEW_CONFIG: ViewConfigEV = {
  filter: {},
  groupBy: "status",
  sort: { key: "date", dir: "asc" },
  mode: "list",
};

/** The canonical config for each built-in view. `my-events` uses leadId:"me",
 * resolved to the current person at filter time. */
export function builtInEventConfig(key: BuiltInEventViewKey): ViewConfigEV {
  switch (key) {
    case "all":
      return { filter: {}, groupBy: "status", sort: { key: "date", dir: "asc" }, mode: "list" };
    case "my-events":
      return { filter: { leadId: "me" }, groupBy: "month", sort: { key: "date", dir: "asc" }, mode: "list" };
    case "upcoming":
      return { filter: { date: "upcoming" }, groupBy: "month", sort: { key: "date", dir: "asc" }, mode: "list" };
    case "past":
      return { filter: { date: "past" }, groupBy: "month", sort: { key: "date", dir: "desc" }, mode: "list" };
    case "drafts":
      return { filter: { published: "draft" }, groupBy: "status", sort: { key: "date", dir: "asc" }, mode: "list" };
    case "by-committee":
      return { filter: {}, groupBy: "committee", sort: { key: "date", dir: "asc" }, mode: "list" };
    case "related":
      return { filter: {}, groupBy: "cluster", sort: { key: "date", dir: "asc" }, mode: "list" };
    case "calendar":
      return { filter: {}, groupBy: "none", sort: { key: "date", dir: "asc" }, mode: "calendar" };
  }
}

export const BUILT_IN_EVENT_VIEWS: { key: BuiltInEventViewKey; label: string }[] = [
  { key: "all", label: "All Events" },
  { key: "my-events", label: "My Events" },
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "drafts", label: "Drafts" },
  { key: "by-committee", label: "By Committee" },
  { key: "related", label: "Related" },
  { key: "calendar", label: "Calendar" },
];

// --- Options for the controls ------------------------------------------------

export const EVENT_GROUP_BY_OPTIONS: { value: EventGroupBy; label: string }[] = [
  { value: "none", label: "No grouping" },
  { value: "cluster", label: "Connected series" },
  { value: "status", label: "Status" },
  { value: "type", label: "Type" },
  { value: "committee", label: "Committee" },
  { value: "lead", label: "Lead" },
  { value: "format", label: "Format" },
  { value: "month", label: "Month" },
  { value: "trimester", label: "Trimester" },
  { value: "dusa", label: "DUSA status" },
];

export const EVENT_SORT_OPTIONS: { value: EventSortKey; label: string }[] = [
  { value: "date", label: "Start date" },
  { value: "name", label: "Name" },
  { value: "status", label: "Status" },
  { value: "created", label: "Created" },
  { value: "attendance", label: "Attendance" },
];

export const EVENT_DATE_OPTIONS: { value: EventDateBucket; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "thisweek", label: "This week" },
  { value: "thismonth", label: "This month" },
  { value: "past", label: "Past" },
  { value: "undated", label: "No date" },
];

const GROUP_KEYS = new Set(EVENT_GROUP_BY_OPTIONS.map((o) => o.value));
const SORT_KEYS = new Set(EVENT_SORT_OPTIONS.map((o) => o.value));
const DATE_KEYS = new Set(EVENT_DATE_OPTIONS.map((o) => o.value));

/** Clamp arbitrary (e.g. persisted / user-supplied) input into a valid config.
 * Used when loading saved views and before persisting them. */
export function sanitizeEventViewConfig(raw: unknown): ViewConfigEV {
  const r = (raw ?? {}) as Partial<ViewConfigEV>;
  const groupBy = r.groupBy && GROUP_KEYS.has(r.groupBy) ? r.groupBy : "status";
  const sortKey = r.sort?.key && SORT_KEYS.has(r.sort.key) ? r.sort.key : "date";
  const dir = r.sort?.dir === "desc" ? "desc" : "asc";
  const mode = r.mode === "calendar" ? "calendar" : "list";
  const f = (r.filter ?? {}) as EventFilter;
  const filter: EventFilter = {
    status: typeof f.status === "string" ? f.status : null,
    type: typeof f.type === "string" ? f.type : null,
    committee: typeof f.committee === "string" ? f.committee : null,
    leadId: f.leadId === "me" || typeof f.leadId === "number" ? f.leadId : null,
    format: typeof f.format === "string" ? f.format : null,
    dusa: typeof f.dusa === "string" ? f.dusa : null,
    date: f.date && DATE_KEYS.has(f.date) ? f.date : null,
    published: f.published === "published" || f.published === "draft" ? f.published : null,
    search: typeof f.search === "string" ? f.search.slice(0, 200) : null,
  };
  return { filter, groupBy, sort: { key: sortKey, dir }, mode };
}

// --- Date bucketing ----------------------------------------------------------

const DAY = 86_400_000;

/** The day an event "ends" for past/upcoming purposes (end date if multi-day). */
function effectiveEnd(e: EventWithLead): string | null {
  return e.endDate ?? e.startDate ?? null;
}

/** Does an event satisfy a coarse date-window filter? */
function matchesDate(e: EventWithLead, bucket: EventDateBucket, today: string): boolean {
  if (bucket === "undated") return !e.startDate;
  if (!e.startDate) return false;
  const end = effectiveEnd(e) ?? e.startDate;
  switch (bucket) {
    case "past":
      return end < today;
    case "upcoming":
      return end >= today;
    case "thisweek": {
      if (end < today) return false;
      const days = Math.round((Date.parse(e.startDate) - Date.parse(today)) / DAY);
      return e.startDate <= today ? end >= today : days <= 7;
    }
    case "thismonth":
      return end >= today && e.startDate.slice(0, 7) === today.slice(0, 7);
  }
}

// --- Filtering ---------------------------------------------------------------

/** Apply a filter to the events pool. `personId` resolves leadId:"me"; if the
 * viewer has no linked person it matches nothing (rather than every event). */
export function applyEventFilters(
  events: EventWithLead[],
  filter: EventFilter,
  personId: number | null,
  today: string,
): EventWithLead[] {
  let leadId = filter.leadId;
  if (leadId === "me") leadId = personId == null ? -1 : personId;
  const search = filter.search?.trim().toLowerCase();

  return events.filter((e) => {
    if (filter.status != null && e.status !== filter.status) return false;
    if (filter.type != null && e.type !== filter.type) return false;
    if (filter.committee != null && e.committee !== filter.committee) return false;
    if (leadId != null && e.eventLeadId !== leadId) return false;
    if (filter.format != null && e.format !== filter.format) return false;
    if (filter.dusa != null && (e.dusaSubmissionStatus ?? "Not Started") !== filter.dusa) return false;
    if (filter.published === "published" && !e.isPublic) return false;
    if (filter.published === "draft" && e.isPublic) return false;
    if (filter.date != null && !matchesDate(e, filter.date, today)) return false;
    if (search) {
      const hay = `${e.name} ${e.description ?? ""} ${e.venue ?? ""}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });
}

/** True if the filter constrains anything (drives the "clear filters" affordance). */
export function isEventFilterActive(filter: EventFilter): boolean {
  return Boolean(
    filter.status != null ||
      filter.type != null ||
      filter.committee != null ||
      filter.leadId != null ||
      filter.format != null ||
      filter.dusa != null ||
      filter.date != null ||
      filter.published != null ||
      (filter.search && filter.search.trim()),
  );
}

// --- Sorting -----------------------------------------------------------------

const STATUS_RANK: Record<string, number> = Object.fromEntries(EVENT_STATUSES.map((s, i) => [s, i]));

function attendanceOf(e: EventWithLead): number | null {
  return e.actualAttendance ?? e.expectedAttendance ?? null;
}

export function sortEvents(
  events: EventWithLead[],
  sort: { key: EventSortKey; dir: "asc" | "desc" },
): EventWithLead[] {
  const dir = sort.dir === "desc" ? -1 : 1;
  const out = [...events];
  out.sort((a, b) => {
    let cmp = 0;
    switch (sort.key) {
      case "date":
        // Nulls last regardless of direction.
        if (a.startDate === b.startDate) cmp = 0;
        else if (!a.startDate) return 1;
        else if (!b.startDate) return -1;
        else cmp = a.startDate < b.startDate ? -1 : 1;
        break;
      case "name":
        cmp = a.name.localeCompare(b.name);
        break;
      case "status":
        cmp = (STATUS_RANK[a.status ?? ""] ?? 99) - (STATUS_RANK[b.status ?? ""] ?? 99);
        break;
      case "attendance": {
        const av = attendanceOf(a);
        const bv = attendanceOf(b);
        if (av === bv) cmp = 0;
        else if (av == null) return 1;
        else if (bv == null) return -1;
        else cmp = av - bv;
        break;
      }
      case "created":
        cmp = a.id - b.id; // id is a monotonic proxy for creation order
        break;
    }
    if (cmp === 0) cmp = a.id - b.id;
    return cmp * dir;
  });
  return out;
}

// --- Grouping ----------------------------------------------------------------

export type EventGroup = { key: string; label: string; events: EventWithLead[] };

const NONE_KEY = "__none__";

const MONTH_FMT = (key: string): string => {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleDateString("en-AU", { month: "long", year: "numeric" });
};

/** The grouping value for an event on a given axis. */
export function eventGroupValue(e: EventWithLead, by: EventGroupBy): { key: string; label: string } {
  switch (by) {
    case "status":
      return e.status ? { key: e.status, label: e.status } : { key: NONE_KEY, label: "No status" };
    case "type":
      return e.type ? { key: e.type, label: e.type } : { key: NONE_KEY, label: "No type" };
    case "committee":
      return e.committee ? { key: e.committee, label: e.committee } : { key: NONE_KEY, label: "No committee" };
    case "lead":
      return e.eventLeadId == null
        ? { key: NONE_KEY, label: "No lead" }
        : { key: String(e.eventLeadId), label: e.leadName ?? `Person ${e.eventLeadId}` };
    case "format":
      return e.format ? { key: e.format, label: e.format } : { key: NONE_KEY, label: "No format" };
    case "trimester":
      return e.trimester ? { key: e.trimester, label: e.trimester } : { key: NONE_KEY, label: "No trimester" };
    case "dusa": {
      const s = e.dusaSubmissionStatus ?? "Not Started";
      return { key: s, label: s };
    }
    case "month": {
      if (!e.startDate) return { key: NONE_KEY, label: "No date" };
      const key = e.startDate.slice(0, 7);
      return { key, label: MONTH_FMT(key) };
    }
    case "none":
    case "cluster":
      // "cluster" is computed from the connection graph by clusterEvents(), not
      // per-event here; this branch only exists so the switch stays exhaustive.
      return { key: "all", label: "" };
  }
}

/** Group events for rendering. Preserves the incoming (already-sorted) order
 * within each group; orders the groups themselves sensibly per axis. `sortDir`
 * only affects "month" ordering (chronological asc/desc to follow the sort).
 * NB: pass "cluster" to clusterEvents() instead — it needs the edge list. */
export function groupEvents(
  events: EventWithLead[],
  by: EventGroupBy,
  sortDir: SortDir = "asc",
): EventGroup[] {
  if (by === "none" || by === "cluster") return [{ key: "all", label: "", events }];

  const map = new Map<string, EventGroup>();
  for (const e of events) {
    const { key, label } = eventGroupValue(e, by);
    let g = map.get(key);
    if (!g) {
      g = { key, label, events: [] };
      map.set(key, g);
    }
    g.events.push(e);
  }
  const groups = [...map.values()];

  const fixedOrder = (fixed: readonly string[]) => (a: EventGroup, b: EventGroup) => {
    const ai = fixed.indexOf(a.key);
    const bi = fixed.indexOf(b.key);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    if (a.key === NONE_KEY) return 1;
    if (b.key === NONE_KEY) return -1;
    return a.label.localeCompare(b.label);
  };

  switch (by) {
    case "status":
      groups.sort(fixedOrder(EVENT_STATUSES));
      break;
    case "type":
      groups.sort(fixedOrder(EVENT_TYPES));
      break;
    case "format":
      groups.sort(fixedOrder(EVENT_FORMATS));
      break;
    case "dusa":
      groups.sort(fixedOrder(DUSA_STATUSES));
      break;
    case "month":
      groups.sort((a, b) => {
        if (a.key === NONE_KEY) return 1;
        if (b.key === NONE_KEY) return -1;
        return sortDir === "desc" ? b.key.localeCompare(a.key) : a.key.localeCompare(b.key);
      });
      break;
    default:
      groups.sort((a, b) => {
        if (a.key === NONE_KEY) return 1;
        if (b.key === NONE_KEY) return -1;
        return a.label.localeCompare(b.label);
      });
  }
  return groups;
}

// --- Connected-component clustering ("Related" view) -------------------------

const CLUSTER_FALLBACK_LABEL = "Connected events";

export type EventClustering = {
  /** Cluster cards (size ≥ 2) first, then a single "Not linked" group. */
  groups: EventGroup[];
  /** Per-event distinct connection labels, for the "↳ Series" row annotation. */
  labelsByEvent: Map<number, string[]>;
};

/**
 * Group events by connected component over the event_connection graph: any set
 * of events reachable from each other through links becomes one cluster card.
 * Solo events (no links, or whose partners are filtered out of `events`) fall
 * into a trailing "Not linked" group. Union-find; only ids present in `events`
 * are unioned, so edges to filtered-out / archived events are ignored.
 *
 * `events` is consumed in its incoming (already-sorted) order, so clusters are
 * emitted in the order their first member appears and rows stay sorted.
 */
export function clusterEvents(events: EventWithLead[], edges: EventEdge[]): EventClustering {
  const parent = new Map<number, number>();
  for (const e of events) parent.set(e.id, e.id);

  const find = (x: number): number => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    let cur = x;
    while (parent.get(cur) !== root) {
      const next = parent.get(cur)!;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  const labelSets = new Map<number, Set<string>>();
  const addLabel = (id: number, label: string) => {
    let s = labelSets.get(id);
    if (!s) labelSets.set(id, (s = new Set()));
    s.add(label);
  };

  const valid: EventEdge[] = [];
  for (const edge of edges) {
    if (!parent.has(edge.eventAId) || !parent.has(edge.eventBId)) continue;
    union(edge.eventAId, edge.eventBId);
    valid.push(edge);
    if (edge.label) {
      addLabel(edge.eventAId, edge.label);
      addLabel(edge.eventBId, edge.label);
    }
  }

  // Most-common edge label per cluster → the cluster card's title.
  const clusterLabels = new Map<number, Map<string, number>>();
  for (const edge of valid) {
    if (!edge.label) continue;
    const root = find(edge.eventAId);
    let counts = clusterLabels.get(root);
    if (!counts) clusterLabels.set(root, (counts = new Map()));
    counts.set(edge.label, (counts.get(edge.label) ?? 0) + 1);
  }

  // Bucket events by cluster root, preserving first-appearance order.
  const order: number[] = [];
  const byRoot = new Map<number, EventWithLead[]>();
  for (const e of events) {
    const root = find(e.id);
    let list = byRoot.get(root);
    if (!list) {
      byRoot.set(root, (list = []));
      order.push(root);
    }
    list.push(e);
  }

  const groups: EventGroup[] = [];
  const singles: EventWithLead[] = [];
  for (const root of order) {
    const list = byRoot.get(root)!;
    if (list.length < 2) {
      singles.push(...list);
      continue;
    }
    const counts = clusterLabels.get(root);
    const label =
      counts && counts.size
        ? [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0]
        : CLUSTER_FALLBACK_LABEL;
    groups.push({ key: `cluster:${root}`, label, events: list });
  }
  if (singles.length) groups.push({ key: NONE_KEY, label: "Not linked", events: singles });

  const labelsByEvent = new Map<number, string[]>();
  for (const [id, set] of labelSets) labelsByEvent.set(id, [...set]);

  return { groups, labelsByEvent };
}
