"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { appRole, appUser } from "@/db/schema";
import { requireAdmin } from "@/lib/dal";
import { canAccess, canWrite, MODULE_KEYS, type AccessLevel } from "@/lib/rbac";
import { bool, int, str } from "@/lib/form-data";
import { hashPassword, validatePassword } from "@/lib/password";
import { snapshotForUpdate } from "@/lib/undo";
import type { ActionResult } from "@/lib/undo-types";

export type FormState = ActionResult;

/** Count active users whose role grants the admin module. */
async function activeAdminCount(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(appUser)
    .innerJoin(appRole, eq(appUser.roleId, appRole.id))
    .where(and(eq(appUser.isActive, true), sql`${appRole.modules}::jsonb ? 'admin'`));
  return row?.n ?? 0;
}

async function roleOf(roleId: number | null) {
  if (!roleId) return undefined;
  const [role] = await db.select().from(appRole).where(eq(appRole.id, roleId)).limit(1);
  return role;
}

export async function updateUser(
  id: number,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();

  const [target] = await db.select().from(appUser).where(eq(appUser.id, id)).limit(1);
  if (!target) return { error: "User not found." };

  const name = str(fd, "name");
  const roleId = int(fd, "role_id");
  const isActive = bool(fd, "is_active");
  const newPassword = str(fd, "password");

  if (!roleId) return { error: "Please choose a role." };
  const role = await roleOf(roleId);
  if (!role) return { error: "That role no longer exists." };

  const currentRole = await roleOf(target.roleId);
  const targetWasActiveAdmin = target.isActive && !!currentRole?.modules.includes("admin");
  const grantsAdmin = role.modules.includes("admin");

  // Guard against removing the last active admin (lockout).
  const losingAdmin = targetWasActiveAdmin && (!grantsAdmin || !isActive);
  if (losingAdmin && (await activeAdminCount()) <= 1) {
    return { error: "This is the only active admin — assign another admin first." };
  }
  if (admin.id === id && !isActive) {
    return { error: "You can't deactivate your own account." };
  }

  // Per-user custom privileges: the form posts the chosen EFFECTIVE level per
  // operational module; we store only what's ELEVATED above the role baseline
  // (additive). "admin" is never grantable here (role-only — keeps the lockout
  // guard valid).
  const ops = MODULE_KEYS.filter((k) => k !== "admin");
  const levels = Object.fromEntries(
    ops.map((k) => [k, (str(fd, `extra:${k}`) ?? "none") as AccessLevel]),
  ) as Record<string, AccessLevel>;
  const extraModules = ops.filter(
    (k) => (levels[k] === "read" || levels[k] === "write") && !canAccess(role.modules, k),
  );
  const extraWriteModules = ops.filter(
    (k) => levels[k] === "write" && !canWrite(role.modules, role.writeModules, k),
  );

  const set: Record<string, unknown> = {
    name: name ?? target.name,
    roleId,
    role: role.name,
    isActive,
    extraModules,
    extraWriteModules,
    updatedAt: new Date().toISOString(),
  };
  if (newPassword) {
    const policyError = validatePassword(newPassword);
    if (policyError) return { error: policyError };
    set.passwordHash = await hashPassword(newPassword);
  }

  // Snapshot the prior row so the change (role / active / password) is undoable.
  const undo = await snapshotForUpdate("user", id);
  await db.update(appUser).set(set).where(eq(appUser.id, id));
  revalidatePath("/admin/users");
  return { ok: true, message: "User updated", undo };
}

/**
 * Send a user back through the first-run onboarding wizard by clearing their
 * completion stamp. Their next navigation into the app is forced to /onboarding
 * (the (app) layout reads this fresh each request). Their existing profile is
 * kept and prefilled — this re-triggers the flow, it doesn't wipe their data.
 */
export async function resetUserOnboarding(id: number): Promise<FormState> {
  await requireAdmin();

  const [target] = await db.select().from(appUser).where(eq(appUser.id, id)).limit(1);
  if (!target) return { error: "User not found." };
  if (!target.onboardingCompletedAt) {
    return { ok: true, message: "User is already set to onboard." };
  }

  await db
    .update(appUser)
    .set({ onboardingCompletedAt: null, updatedAt: new Date().toISOString() })
    .where(eq(appUser.id, id));
  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${id}/edit`);
  return { ok: true, message: "Onboarding reset — they'll set up their profile again." };
}

export async function setUserActive(id: number, active: boolean): Promise<void> {
  const admin = await requireAdmin();
  if (admin.id === id && !active) redirect("/admin/users");

  if (!active) {
    const [target] = await db.select().from(appUser).where(eq(appUser.id, id)).limit(1);
    const role = await roleOf(target?.roleId ?? null);
    if (target?.isActive && role?.modules.includes("admin") && (await activeAdminCount()) <= 1) {
      redirect("/admin/users");
    }
  }

  await db
    .update(appUser)
    .set({ isActive: active, updatedAt: new Date().toISOString() })
    .where(eq(appUser.id, id));
  revalidatePath("/admin/users");
  redirect("/admin/users");
}
