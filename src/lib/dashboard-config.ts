/**
 * Single source of truth for the dashboard's section catalog and each role's
 * default "Focus" config (ViewConfig). PURE + edge-safe: type-only imports, no
 * DB, no server code — safe to import from the DAL, the admin role form, the
 * dashboard page, and edge code.
 *
 * KEEP IN SYNC with `scripts/setup-roles-v2.ts` (which inlines the same role
 * defaults as raw values, since migration scripts can't import from `@/`).
 */
import type { ViewConfig } from "@/db/schema";
import type { ModuleKey } from "@/lib/rbac";

/** A dashboard section the role's viewConfig can toggle on/off. */
export type DashboardSection = {
  id: string;
  label: string;
  description: string;
  /** Module required to SEE this section (defense-in-depth; Focus never widens). */
  module: ModuleKey;
};

/**
 * Canonical dashboard sections. The `id`s are the keys used in
 * `ViewConfig.sections`. Adding a section here makes it available in the admin
 * role editor automatically.
 */
export const CANONICAL_SECTIONS: readonly DashboardSection[] = [
  { id: "my_work", label: "My Work", description: "Tasks assigned to you, grouped by due date.", module: "tasks" },
  { id: "upcoming_events", label: "Upcoming events", description: "The next events on the calendar.", module: "events" },
  { id: "tasks_due_soon", label: "Tasks due soon", description: "Everything due in the next two weeks.", module: "tasks" },
  { id: "action_items", label: "Action items", description: "Open follow-ups from recent meetings.", module: "meetings" },
  { id: "committee_health", label: "Committee health", description: "Per-committee open/overdue tasks + lead.", module: "tasks" },
  { id: "membership", label: "Membership", description: "Member count + DUSA trend.", module: "members" },
  { id: "finance_summary", label: "Finance summary", description: "Balance, income, expenses.", module: "finance" },
  { id: "expense_breakdown", label: "Expense breakdown", description: "Spending by category.", module: "finance" },
  { id: "event_budgets", label: "Event budgets", description: "Allocated vs spent per event.", module: "finance" },
  { id: "sponsor_pipeline", label: "Sponsor pipeline", description: "Deals by stage + next steps.", module: "sponsors" },
] as const;

export const CANONICAL_SECTION_IDS: readonly string[] = CANONICAL_SECTIONS.map((s) => s.id);

/** Build a sections map (id -> true) from a visible-id list. */
function sectionsFrom(ids: string[]): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const id of ids) out[id] = true;
  return out;
}

function vc(landingPath: string, sectionIds: string[], defaultTaskView: string): ViewConfig {
  return { version: 1, sections: sectionsFrom(sectionIds), landingPath, defaultTaskView };
}

/**
 * Per-role default Focus config, keyed by lower-cased role name. Mirrors the
 * blueprint role table. Unknown roles fall back to GENERIC_DEFAULT.
 */
const GENERIC_DEFAULT: ViewConfig = vc("/dashboard", ["my_work", "upcoming_events"], "my-work");

const ROLE_DEFAULTS: Record<string, ViewConfig> = {
  admin: vc("/dashboard", [...CANONICAL_SECTION_IDS], "all-tasks"),
  exec: vc(
    "/dashboard",
    ["my_work", "upcoming_events", "tasks_due_soon", "action_items", "committee_health", "membership", "finance_summary", "sponsor_pipeline"],
    "my-work",
  ),
  secretary: vc("/meetings", ["my_work", "upcoming_events", "action_items"], "my-work"),
  "external affairs lead": vc("/sponsors", ["my_work", "sponsor_pipeline", "upcoming_events", "action_items"], "by-committee"),
  "external affairs member": vc("/sponsors", ["my_work", "sponsor_pipeline"], "my-work"),
  "marketing lead": vc("/tasks", ["my_work", "upcoming_events", "tasks_due_soon", "action_items"], "by-committee"),
  "marketing member": vc("/tasks", ["my_work", "upcoming_events"], "my-work"),
  "design lead": vc("/tasks", ["my_work", "upcoming_events", "action_items"], "by-committee"),
  "design member": vc("/tasks", ["my_work"], "my-work"),
  "development lead": vc("/projects", ["my_work", "upcoming_events", "action_items"], "by-committee"),
  "development member": vc("/projects", ["my_work"], "my-work"),
  "general member": vc("/tasks", ["my_work"], "my-work"),
  treasurer: vc("/finance", ["finance_summary", "expense_breakdown", "event_budgets"], "my-work"),
  auditor: vc("/dashboard", ["upcoming_events", "membership", "finance_summary", "sponsor_pipeline", "committee_health"], "all-tasks"),
  viewer: vc("/dashboard", [], "my-work"),
};

// Roles that see EVERY committee's meetings/notes; everyone else is scoped to
// their own committee (+ club-wide). Keyed by lower-cased role name.
const ALL_COMMITTEE_ROLES = new Set(["admin", "exec", "secretary", "auditor"]);

export function defaultCommitteeScope(roleName: string | null | undefined): "all" | "own" {
  return ALL_COMMITTEE_ROLES.has((roleName ?? "").toLowerCase()) ? "all" : "own";
}

/** The default Focus config for a role name (case-insensitive). */
export function getDefaultViewConfig(roleName: string | null | undefined): ViewConfig {
  const base = roleName ? ROLE_DEFAULTS[roleName.toLowerCase()] ?? GENERIC_DEFAULT : GENERIC_DEFAULT;
  return { ...base, committeeScope: defaultCommitteeScope(roleName) };
}

/**
 * Normalise a possibly-null / legacy viewConfig into a complete one, merging in
 * the role default for any missing piece. The DAL calls this so consumers never
 * see a null or half-shaped config.
 */
export function normalizeViewConfig(raw: ViewConfig | null | undefined, roleName: string | null | undefined): ViewConfig {
  const fallback = getDefaultViewConfig(roleName);
  if (!raw || typeof raw !== "object") return fallback;
  const hasSections = raw.sections && typeof raw.sections === "object" && Object.keys(raw.sections).length > 0;
  return {
    version: 1,
    sections: hasSections ? raw.sections : fallback.sections,
    landingPath: raw.landingPath ?? fallback.landingPath,
    defaultTaskView: raw.defaultTaskView ?? fallback.defaultTaskView,
    navOrder: raw.navOrder ?? fallback.navOrder,
    committeeScope: raw.committeeScope ?? fallback.committeeScope,
  };
}

/** The set of section ids a role's viewConfig has switched on. */
export function visibleSections(viewConfig: ViewConfig): Set<string> {
  const out = new Set<string>();
  for (const [id, on] of Object.entries(viewConfig.sections ?? {})) {
    if (on) out.add(id);
  }
  return out;
}
