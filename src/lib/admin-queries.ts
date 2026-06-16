import "server-only";

import { asc, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { appInvite, appRole, appUser, committee } from "@/db/schema";

export type UserRow = {
  id: number;
  email: string;
  name: string | null;
  isActive: boolean;
  onboardingCompletedAt: string | null;
  roleId: number | null;
  roleName: string | null;
  roleModules: string[] | null;
  createdAt: string;
};

export type RoleRow = {
  id: number;
  name: string;
  description: string | null;
  modules: string[];
  writeModules: string[];
  isSystem: boolean;
  userCount: number;
};

export type InviteRow = {
  id: number;
  email: string;
  status: string;
  roleId: number;
  roleName: string | null;
  committee: string | null;
  invitedBy: string | null;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  expired: boolean;
};

export async function getUsers(): Promise<UserRow[]> {
  return db
    .select({
      id: appUser.id,
      email: appUser.email,
      name: appUser.name,
      isActive: appUser.isActive,
      onboardingCompletedAt: appUser.onboardingCompletedAt,
      roleId: appUser.roleId,
      roleName: appRole.name,
      roleModules: appRole.modules,
      createdAt: appUser.createdAt,
    })
    .from(appUser)
    .leftJoin(appRole, eq(appUser.roleId, appRole.id))
    .orderBy(asc(appUser.email));
}

export async function getUserById(id: number): Promise<UserRow | undefined> {
  const [row] = await db
    .select({
      id: appUser.id,
      email: appUser.email,
      name: appUser.name,
      isActive: appUser.isActive,
      onboardingCompletedAt: appUser.onboardingCompletedAt,
      roleId: appUser.roleId,
      roleName: appRole.name,
      roleModules: appRole.modules,
      createdAt: appUser.createdAt,
    })
    .from(appUser)
    .leftJoin(appRole, eq(appUser.roleId, appRole.id))
    .where(eq(appUser.id, id))
    .limit(1);
  return row;
}

// Correlated subquery: number of users carrying each role.
const roleUserCount = sql<number>`(select count(*) from ${appUser} where ${appUser.roleId} = ${appRole.id})`.mapWith(
  Number,
);

export async function getRoles(): Promise<RoleRow[]> {
  return db
    .select({
      id: appRole.id,
      name: appRole.name,
      description: appRole.description,
      modules: appRole.modules,
      writeModules: appRole.writeModules,
      isSystem: appRole.isSystem,
      userCount: roleUserCount,
    })
    .from(appRole)
    .orderBy(desc(appRole.isSystem), asc(appRole.name));
}

export async function getRoleById(id: number): Promise<RoleRow | undefined> {
  const [row] = await db
    .select({
      id: appRole.id,
      name: appRole.name,
      description: appRole.description,
      modules: appRole.modules,
      writeModules: appRole.writeModules,
      isSystem: appRole.isSystem,
      userCount: roleUserCount,
    })
    .from(appRole)
    .where(eq(appRole.id, id))
    .limit(1);
  return row;
}

/** Roles for <select>s — id + name only, system roles first. */
export async function getRoleOptions(): Promise<{ id: number; name: string }[]> {
  return db
    .select({ id: appRole.id, name: appRole.name })
    .from(appRole)
    .orderBy(desc(appRole.isSystem), asc(appRole.name));
}

export async function getInvites(): Promise<InviteRow[]> {
  return db
    .select({
      id: appInvite.id,
      email: appInvite.email,
      status: appInvite.status,
      roleId: appInvite.roleId,
      roleName: appRole.name,
      committee: appInvite.committee,
      invitedBy: appInvite.invitedBy,
      createdAt: appInvite.createdAt,
      expiresAt: appInvite.expiresAt,
      acceptedAt: appInvite.acceptedAt,
      expired: sql<boolean>`${appInvite.expiresAt} < now()`.mapWith(Boolean),
    })
    .from(appInvite)
    .leftJoin(appRole, eq(appInvite.roleId, appRole.id))
    .orderBy(desc(appInvite.createdAt));
}

export async function getAdminCounts(): Promise<{
  users: number;
  activeUsers: number;
  roles: number;
  pendingInvites: number;
  committees: number;
}> {
  const [users, activeUsers, roles, pendingInvites, committees] = await Promise.all([
    db.$count(appUser),
    db.$count(appUser, eq(appUser.isActive, true)),
    db.$count(appRole),
    db.$count(appInvite, eq(appInvite.status, "pending")),
    db.$count(committee, eq(committee.isActive, true)),
  ]);
  return { users, activeUsers, roles, pendingInvites, committees };
}
