// Role-based access control primitives. PURE and edge-safe (no node/db imports)
// so `auth.config.ts` — loaded by the proxy on every request — can import it.

export type ModuleKey =
  | "events"
  | "people"
  | "sponsors"
  | "partners"
  | "finance"
  | "tasks"
  | "projects"
  | "members"
  | "meetings"
  | "documents"
  | "links"
  | "admin";

export type ModuleDef = {
  key: ModuleKey;
  label: string;
  href: string;
  description: string;
};

/** Gateable modules. "Overview" (/) is intentionally absent — it is always
 * available to any active user. The "admin" module grants the admin panel AND
 * acts as a superuser flag (see `canAccess`). */
export const MODULES: ModuleDef[] = [
  { key: "events", label: "Events", href: "/events", description: "Event planning, DUSA submissions, and the calendar." },
  { key: "people", label: "People", href: "/people", description: "Committee roster and contacts." },
  { key: "sponsors", label: "Sponsors", href: "/sponsors", description: "Sponsorship pipeline and agreements." },
  { key: "partners", label: "Partners", href: "/partners", description: "Collaborator clubs and partner orgs that co-host events." },
  { key: "finance", label: "Finance", href: "/finance", description: "Budget, grants, reimbursements, and income." },
  { key: "tasks", label: "Tasks", href: "/tasks", description: "Trello-style task boards and assignments." },
  { key: "projects", label: "Projects", href: "/projects", description: "Community projects shown on the public website." },
  { key: "members", label: "Members", href: "/members", description: "Weekly DUSA membership roster and growth stats." },
  { key: "meetings", label: "Meetings", href: "/meetings", description: "Meeting records and AI-generated minutes." },
  { key: "documents", label: "Docs", href: "/docs", description: "Notion-style docs, meeting notes, and deliverables." },
  { key: "links", label: "Link Tree", href: "/links", description: "The public link-tree page (profile + ordered link stack)." },
  { key: "admin", label: "Admin", href: "/admin", description: "Manage users, roles, and invites. Implies full access to every module." },
];

export const MODULE_KEYS = MODULES.map((m) => m.key);

/** Modules a non-admin role may be granted (admin is implicit/superuser). */
export const ASSIGNABLE_MODULES = MODULES;

/** A user can access `key` if their role lists it, or if it lists "admin"
 * (admin = superuser, sees everything including modules added later). */
export function canAccess(modules: readonly string[] | null | undefined, key: string): boolean {
  if (!modules) return false;
  return modules.includes("admin") || modules.includes(key);
}

export function isAdmin(modules: readonly string[] | null | undefined): boolean {
  return !!modules && modules.includes("admin");
}

/** Map a pathname to the module that owns it, or null if it is always-allowed. */
export function moduleForPath(pathname: string): ModuleKey | null {
  for (const m of MODULES) {
    if (pathname === m.href || pathname.startsWith(`${m.href}/`)) return m.key;
  }
  return null;
}

/** Whether `path` is a valid landing/redirect target for these modules: true if
 * the path's owning module is accessible, or the path is always-allowed (e.g.
 * /dashboard). Used to validate a role's Focus landingPath so it can never point
 * a user at a module they lack. Pure/edge-safe. */
export function isValidLandingPath(
  modules: readonly string[] | null | undefined,
  path: string | null | undefined,
): boolean {
  if (!path || !path.startsWith("/")) return false;
  const mod = moduleForPath(path);
  return mod === null || canAccess(modules, mod);
}

/** Keep only valid, de-duplicated module keys from arbitrary input. */
export function sanitizeModules(input: readonly string[]): ModuleKey[] {
  const valid = new Set<string>(MODULE_KEYS);
  return MODULE_KEYS.filter((k) => input.includes(k) && valid.has(k));
}

// --- Read vs write granularity ------------------------------------------------
// `canAccess`/`modules` above answer "can this role SEE the module". The helpers
// below add a second tier: which of those modules the role may also EDIT. Write
// always implies read, and "admin" is a superuser for both.

/** A user can write to `key` if they are an admin (superuser) or their role
 * grants both read AND write for that module. */
export function canWrite(
  modules: readonly string[] | null | undefined,
  writeModules: readonly string[] | null | undefined,
  key: string,
): boolean {
  if (!modules) return false;
  if (modules.includes("admin")) return true;
  return modules.includes(key) && !!writeModules?.includes(key);
}

/** Per-module access tier, as configured in the role editor. */
export type AccessLevel = "none" | "read" | "write";

/** Resolve a module's access tier from a role's read + write sets. */
export function levelFor(
  modules: readonly string[] | null | undefined,
  writeModules: readonly string[] | null | undefined,
  key: string,
): AccessLevel {
  if (!canAccess(modules, key)) return "none";
  return canWrite(modules, writeModules, key) ? "write" : "read";
}

/** Keep only valid write keys that are also granted read access (write ⊆ read). */
export function sanitizeWriteModules(
  read: readonly string[],
  write: readonly string[],
): ModuleKey[] {
  const readable = new Set<string>(sanitizeModules(read));
  return sanitizeModules(write).filter((k) => readable.has(k));
}

/** Convert per-module access tiers (from the role form) into the stored
 * `modules` (read) + `writeModules` (write) arrays, enforcing write ⊆ read. */
export function levelsToArrays(levels: Record<string, AccessLevel>): {
  modules: ModuleKey[];
  writeModules: ModuleKey[];
} {
  const read = MODULE_KEYS.filter((k) => levels[k] === "read" || levels[k] === "write");
  const write = MODULE_KEYS.filter((k) => levels[k] === "write");
  return {
    modules: sanitizeModules(read),
    writeModules: sanitizeWriteModules(read, write),
  };
}

// --- Object-level (ownership) access ------------------------------------------
// Layered ON TOP of the module RBAC above, and purely ADDITIVE: a user who lacks
// a module can still reach the specific records they OWN (lead / assignee), plus
// those records' tasks. Derived from the existing owner columns (no schema
// change) — so a role grant is never weakened, only a scoped grant is added.
// These are the pure decisions; the DB lookups live in lib/scope.ts.

/** How a user may access an ownable module:
 *  - "full":  has the module → every record (the existing behaviour).
 *  - "owned": lacks the module but owns ≥1 record → only those records.
 *  - "none":  no access. */
export type ScopedAccess = "full" | "owned" | "none";

/** A record is "owned" by the user when its owner column (e.g. project.leadId,
 * event.eventLeadId) matches the user's linked person id. A login with no
 * roster link (personId null) owns nothing. */
export function isOwner(
  personId: number | null | undefined,
  ownerId: number | null | undefined,
): boolean {
  return personId != null && ownerId != null && personId === ownerId;
}

/** Resolve a user's overall access to an ownable module from the module grant
 * and whether they own any record in it. */
export function scopeFor(hasModule: boolean, ownsAny: boolean): ScopedAccess {
  if (hasModule) return "full";
  return ownsAny ? "owned" : "none";
}

// --- Committee-scoped visibility (meetings + meeting-notes documents) ---------
// A second enforced scope (alongside sponsors/finance module-gating): records
// carry an owning `committee`. A role's committeeScope is "all" (sees every
// committee — exec/secretary/admin/auditor) or "own" (only their committee +
// club-wide). null record committee = club-wide (visible to everyone with the
// module). Pure decisions; the SQL filter lives in workspace-queries.

/** Can a viewer (with this committeeScope + their own committee) READ a record
 * owned by `recordCommittee`? */
export function canSeeCommittee(
  scope: "all" | "own" | undefined,
  userCommittee: string | null | undefined,
  recordCommittee: string | null | undefined,
): boolean {
  if (scope === "all") return true;
  if (recordCommittee == null) return true; // club-wide / all-hands
  return !!userCommittee && recordCommittee === userCommittee;
}

/** Can a viewer WRITE/own a committee record? "all" scope → any; "own" scope →
 * only their own committee (never club-wide or another team's). */
export function canWriteCommittee(
  scope: "all" | "own" | undefined,
  userCommittee: string | null | undefined,
  recordCommittee: string | null | undefined,
): boolean {
  if (scope === "all") return true;
  return !!userCommittee && recordCommittee === userCommittee;
}

/** Whether a user may manage the related-task list shown on a parent entity's
 * (event / sponsor / project) detail page — the per-row tick, the delete, and the
 * quick-add. Granted to writers of the PARENT module (managing the entity includes
 * managing its task list) OR writers of the Tasks module (a dedicated task editor
 * may manage any task list, even with view-only access to the parent). Pure — used
 * both to gate the UI and as the authoritative check in the related-task Server
 * Actions. */
export function canManageRelatedTasks(
  modules: readonly string[] | null | undefined,
  writeModules: readonly string[] | null | undefined,
  parentKey: "events" | "sponsors" | "projects",
): boolean {
  return canWrite(modules, writeModules, parentKey) || canWrite(modules, writeModules, "tasks");
}

/** Whether a user may WRITE a specific task. Module writers (and admins) may
 * write any task; otherwise a user may write only the tasks ASSIGNED to them
 * (the "Member edits their own tasks" rule). Pure — used both to gate the UI
 * and as the authoritative check in task Server Actions. */
export function canWriteTask(
  modules: readonly string[] | null | undefined,
  writeModules: readonly string[] | null | undefined,
  personId: number | null | undefined,
  assigneeId: number | null | undefined,
): boolean {
  if (canWrite(modules, writeModules, "tasks")) return true;
  return isOwner(personId, assigneeId);
}
