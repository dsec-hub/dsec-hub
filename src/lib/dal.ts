import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/db";
import { appRole, appUser, people, type ViewConfig } from "@/db/schema";
import { canAccess, canWrite, isAdmin, type ModuleKey } from "@/lib/rbac";
import { normalizeViewConfig } from "@/lib/dashboard-config";
import { PREVIEW_COOKIE, verifyPreview } from "@/lib/role-preview";

export type CurrentUser = {
  id: number;
  email: string;
  name: string | null;
  isActive: boolean;
  onboardingCompletedAt: string | null;
  roleId: number | null;
  roleName: string | null;
  personId: number | null;
  /** The committee of this login's linked roster record (people.committee), if
   * any. Drives the Focus layer's default "my committee" filters — presentation
   * only, never an access gate. */
  userCommittee: string | null;
  themeAccent: string | null;
  themeBackground: string | null;
  themeFontTitle: string | null;
  themeFontBody: string | null;
  themeWeightTitle: string | null;
  themeWeightBody: string | null;
  modules: string[];
  writeModules: string[];
  /** Normalised per-role Focus config (never null — see dashboard-config). */
  viewConfig: ViewConfig;
  /** Non-null ONLY when an admin is previewing another role; its name. The
   * overlaid user already carries that role's modules/writeModules/viewConfig. */
  previewRoleName: string | null;
};

/**
 * The REAL signed-in user, fresh from the DB, with NO preview overlay. Use this
 * for admin checks in the preview machinery (so an admin mid-preview can still
 * manage/exit preview). Everything else should use getCurrentUser.
 */
export const getRealUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  const id = Number(session?.user?.id);
  if (!session?.user || Number.isNaN(id)) return null;

  const [row] = await db
    .select({
      id: appUser.id,
      email: appUser.email,
      name: appUser.name,
      isActive: appUser.isActive,
      onboardingCompletedAt: appUser.onboardingCompletedAt,
      roleId: appUser.roleId,
      roleName: appRole.name,
      personId: appUser.personId,
      userCommittee: people.committee,
      viewConfig: appRole.viewConfig,
      extraModules: appUser.extraModules,
      extraWriteModules: appUser.extraWriteModules,
      themeAccent: appUser.themeAccent,
      themeBackground: appUser.themeBackground,
      themeFontTitle: appUser.themeFontTitle,
      themeFontBody: appUser.themeFontBody,
      themeWeightTitle: appUser.themeWeightTitle,
      themeWeightBody: appUser.themeWeightBody,
      modules: appRole.modules,
      writeModules: appRole.writeModules,
    })
    .from(appUser)
    .leftJoin(appRole, eq(appUser.roleId, appRole.id))
    .leftJoin(people, eq(appUser.personId, people.id))
    .where(eq(appUser.id, id))
    .limit(1);

  if (!row) return null;

  // Effective access = role grant UNION the user's per-user extras. Extras are
  // additive (elevate-only); write is clamped to read (write ⊆ read).
  const effectiveModules = union(row.modules, row.extraModules);
  const effectiveWrite = union(row.writeModules, row.extraWriteModules).filter((m) =>
    effectiveModules.includes(m),
  );

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    isActive: row.isActive,
    onboardingCompletedAt: row.onboardingCompletedAt,
    roleId: row.roleId,
    roleName: row.roleName,
    personId: row.personId,
    userCommittee: row.userCommittee ?? null,
    themeAccent: row.themeAccent,
    themeBackground: row.themeBackground,
    themeFontTitle: row.themeFontTitle,
    themeFontBody: row.themeFontBody,
    themeWeightTitle: row.themeWeightTitle,
    themeWeightBody: row.themeWeightBody,
    modules: effectiveModules,
    writeModules: effectiveWrite,
    viewConfig: normalizeViewConfig(row.viewConfig, row.roleName),
    previewRoleName: null,
  };
});

/** Union two module lists, de-duplicated. */
function union(a: unknown, b: unknown): string[] {
  const out = new Set<string>();
  if (Array.isArray(a)) for (const x of a) out.add(String(x));
  if (Array.isArray(b)) for (const x of b) out.add(String(x));
  return [...out];
}

/**
 * The EFFECTIVE user for the request: the real user, with the admin role-preview
 * overlay applied when active. The overlay INTERSECTS module sets (pure
 * narrowing — admin ∩ role = role) and swaps in the previewed role's
 * viewConfig, so every nav/dashboard/gate sees exactly what that role sees.
 * Writes are then blocked by requireWrite while `previewRoleName` is set.
 *
 * Use this everywhere EXCEPT the preview machinery itself (use getRealUser there).
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const real = await getRealUser();
  if (!real || !isAdmin(real.modules)) return real; // only admins can preview
  const roleId = verifyPreview((await cookies()).get(PREVIEW_COOKIE)?.value);
  if (roleId == null) return real;

  const [role] = await db
    .select({
      id: appRole.id,
      name: appRole.name,
      modules: appRole.modules,
      writeModules: appRole.writeModules,
      viewConfig: appRole.viewConfig,
    })
    .from(appRole)
    .where(eq(appRole.id, roleId))
    .limit(1);
  // Missing role, or an admin role (no narrowing) → ignore the cookie.
  if (!role || isAdmin(role.modules)) return real;

  return {
    ...real,
    roleId: role.id,
    roleName: role.name,
    modules: Array.isArray(role.modules) ? role.modules : [],
    writeModules: Array.isArray(role.writeModules) ? role.writeModules : [],
    viewConfig: normalizeViewConfig(role.viewConfig, role.name),
    previewRoleName: role.name,
  };
});

/**
 * Require a signed-in user. The proxy already gates routes, but Server Actions
 * and data reads must verify independently (defense in depth — see the Next.js
 * authentication guide).
 */
export async function requireSession() {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  return session;
}

/** Require an active user, returning their fresh record. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || !user.isActive) redirect("/signin");
  return user;
}

/** Require access to a specific module; bounce to the overview otherwise. */
export async function requireModule(key: ModuleKey): Promise<CurrentUser> {
  const user = await requireUser();
  if (!canAccess(user.modules, key)) redirect("/dashboard");
  return user;
}

/**
 * Require WRITE access to a module — for Server Actions that mutate data. Reads
 * the live record (via requireModule) and bounces view-only users to the
 * overview. The UI hides write controls already; this is the authoritative
 * backstop against forged/stale requests (defense in depth).
 */
export async function requireWrite(key: ModuleKey): Promise<CurrentUser> {
  const user = await requireModule(key);
  if (!canWrite(user.modules, user.writeModules, key)) redirect("/dashboard");
  assertNotPreviewing(user);
  return user;
}

/** Require the admin module (superuser). */
export async function requireAdmin(): Promise<CurrentUser> {
  return requireModule("admin");
}

/** Block a mutation while an admin is previewing another role. The single
 * write chokepoint requireWrite calls this; relaxed task paths that authorise
 * via object-ownership (and so bypass requireWrite) must call it too. */
export function assertNotPreviewing(user: CurrentUser): void {
  if (user.previewRoleName) {
    throw new Error("You're previewing the " + user.previewRoleName + " role — exit preview to make changes.");
  }
}
