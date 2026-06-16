import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/db";
import { appRole, appUser } from "@/db/schema";
import { canAccess, canWrite, type ModuleKey } from "@/lib/rbac";

export type CurrentUser = {
  id: number;
  email: string;
  name: string | null;
  isActive: boolean;
  onboardingCompletedAt: string | null;
  roleId: number | null;
  roleName: string | null;
  personId: number | null;
  themeAccent: string | null;
  themeBackground: string | null;
  themeFontTitle: string | null;
  themeFontBody: string | null;
  themeWeightTitle: string | null;
  themeWeightBody: string | null;
  modules: string[];
  writeModules: string[];
};

/**
 * Authoritative, fresh-from-DB view of the signed-in user and their module
 * access. Memoised per request with React `cache()` so repeated calls in a
 * single render don't re-query. Use this — not the JWT snapshot — for any
 * access decision that must reflect role changes immediately.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
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
    .where(eq(appUser.id, id))
    .limit(1);

  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    isActive: row.isActive,
    onboardingCompletedAt: row.onboardingCompletedAt,
    roleId: row.roleId,
    roleName: row.roleName,
    personId: row.personId,
    themeAccent: row.themeAccent,
    themeBackground: row.themeBackground,
    themeFontTitle: row.themeFontTitle,
    themeFontBody: row.themeFontBody,
    themeWeightTitle: row.themeWeightTitle,
    themeWeightBody: row.themeWeightBody,
    modules: Array.isArray(row.modules) ? row.modules : [],
    writeModules: Array.isArray(row.writeModules) ? row.writeModules : [],
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
  return user;
}

/** Require the admin module (superuser). */
export async function requireAdmin(): Promise<CurrentUser> {
  return requireModule("admin");
}
