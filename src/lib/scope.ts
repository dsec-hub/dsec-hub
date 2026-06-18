import "server-only";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { projects } from "@/db/workspace-schema";
import { canAccess, canWrite, isOwner, scopeFor, type ScopedAccess } from "@/lib/rbac";
import type { CurrentUser } from "@/lib/dal";

/** A user's committee visibility for meetings + meeting-notes documents:
 * `all` → every committee; otherwise scoped to `committee` (+ club-wide). */
export type CommitteeScope = { all: boolean; committee: string | null };

export function committeeScopeOf(user: CurrentUser): CommitteeScope {
  // Admins always see all; otherwise honour the role's committeeScope. (During
  // preview the admin module is narrowed away, so the previewed role's scope
  // applies — exactly what we want.)
  const all = canAccess(user.modules, "admin") || user.viewConfig.committeeScope === "all";
  return { all, committee: user.userCommittee };
}

/**
 * Object-level (ownership) access — the DB half of the model whose pure decisions
 * live in lib/rbac.ts (isOwner / scopeFor). It is PURELY ADDITIVE on top of the
 * module RBAC: a user WITH a module keeps full access; a user WITHOUT it can
 * still reach the records they OWN (lead/assignee), read-only.
 *
 * v1 covers the Projects module (a project lead, e.g. a committee member who
 * isn't granted the whole Projects module, can still see the project they lead
 * and its tasks). The shape generalises to events.eventLeadId, tasks.assigneeId,
 * etc. — add a `<module>Scope` + `canView<Record>` pair per ownable module.
 *
 * Writes deliberately stay module-gated: scoped owners get VIEW access only, so
 * this layer can never escalate a non-writer into a writer.
 */

/** Does this user lead at least one active project? (One indexed lookup.) */
async function leadsAnyProject(personId: number | null): Promise<boolean> {
  if (personId == null) return false;
  const [row] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.leadId, personId), eq(projects.archived, false)))
    .limit(1);
  return !!row;
}

/** The user's overall access to the Projects module: full | owned | none. */
export async function projectScope(user: CurrentUser): Promise<ScopedAccess> {
  const hasModule = canAccess(user.modules, "projects");
  // Skip the ownership lookup entirely for module-holders (the common case).
  if (hasModule) return "full";
  return scopeFor(false, await leadsAnyProject(user.personId));
}

/** Whether to show "Projects" in the nav (module access OR leads ≥1 project). */
export async function canSeeProjects(user: CurrentUser): Promise<boolean> {
  return (await projectScope(user)) !== "none";
}

/**
 * Gate a single project detail view. Returns whether the viewer may WRITE it
 * (only module writers — owners are read-only). Redirects to /dashboard when the
 * user has neither module access nor ownership of THIS project.
 */
export async function requireProjectView(
  user: CurrentUser,
  project: { leadId: number | null },
): Promise<{ writable: boolean }> {
  if (canAccess(user.modules, "projects")) {
    // Use canWrite (not a raw .includes) so an admin superuser — whose
    // writeModules need not list "projects" — is writable, matching the list +
    // edit pages.
    return { writable: canWrite(user.modules, user.writeModules, "projects") };
  }
  if (isOwner(user.personId, project.leadId)) {
    return { writable: false }; // scoped owner: read-only
  }
  redirect("/dashboard");
}
