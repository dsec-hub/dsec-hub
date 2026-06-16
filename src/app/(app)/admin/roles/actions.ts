"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { appRole, appUser } from "@/db/schema";
import { requireAdmin } from "@/lib/dal";
import { str } from "@/lib/form-data";
import { levelsToArrays, MODULE_KEYS, type AccessLevel } from "@/lib/rbac";
import { createToken, snapshotForDelete, snapshotForUpdate } from "@/lib/undo";
import type { ActionResult } from "@/lib/undo-types";

export type FormState = ActionResult;

function parseRole(fd: FormData) {
  // The role form submits one `access:<module>` field per module, each
  // none | read | write. Decode into the stored read + write arrays.
  const levels: Record<string, AccessLevel> = Object.fromEntries(
    MODULE_KEYS.map((k) => [k, (str(fd, `access:${k}`) ?? "none") as AccessLevel]),
  );
  const { modules, writeModules } = levelsToArrays(levels);
  return {
    name: (str(fd, "name") ?? "").slice(0, 64),
    description: str(fd, "description"),
    modules,
    writeModules,
  };
}

async function nameTaken(name: string, exceptId?: number): Promise<boolean> {
  const dupe = await db
    .select({ id: appRole.id })
    .from(appRole)
    .where(
      exceptId
        ? and(sql`lower(${appRole.name}) = lower(${name})`, ne(appRole.id, exceptId))
        : sql`lower(${appRole.name}) = lower(${name})`,
    )
    .limit(1);
  return dupe.length > 0;
}

export async function createRole(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const values = parseRole(fd);
  if (!values.name) return { error: "Role name is required." };
  if (await nameTaken(values.name)) return { error: "A role with that name already exists." };

  const [row] = await db
    .insert(appRole)
    .values({
      name: values.name,
      description: values.description,
      modules: values.modules,
      writeModules: values.writeModules,
      isSystem: false,
    })
    .returning({ id: appRole.id });
  revalidatePath("/admin/roles");
  return { ok: true, message: "Role created", undo: createToken("role", row?.id) };
}

export async function updateRole(
  id: number,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  await requireAdmin();
  const [role] = await db.select().from(appRole).where(eq(appRole.id, id)).limit(1);
  if (!role) return { error: "Role not found." };

  const values = parseRole(fd);
  if (!values.name) return { error: "Role name is required." };
  if (await nameTaken(values.name, id)) {
    return { error: "A role with that name already exists." };
  }

  // System roles (Admin) keep their name + module set locked to avoid lockout;
  // only the description is editable.
  const undo = await snapshotForUpdate("role", id);
  await db
    .update(appRole)
    .set({
      name: role.isSystem ? role.name : values.name,
      description: values.description,
      modules: role.isSystem ? role.modules : values.modules,
      writeModules: role.isSystem ? role.writeModules : values.writeModules,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(appRole.id, id));

  revalidatePath("/admin/roles");
  revalidatePath("/admin/users");
  return { ok: true, message: "Role updated", undo };
}

export async function deleteRole(id: number): Promise<FormState> {
  await requireAdmin();
  const [role] = await db.select().from(appRole).where(eq(appRole.id, id)).limit(1);
  if (!role) return { error: "Role not found." };
  if (role.isSystem) return { error: "System roles can't be deleted." };

  const inUse = await db.$count(appUser, eq(appUser.roleId, id));
  if (inUse > 0) return { error: "Reassign the users on this role before deleting it." };

  const undo = await snapshotForDelete("role", id);
  await db.delete(appRole).where(eq(appRole.id, id));
  revalidatePath("/admin/roles");
  return { ok: true, message: "Role deleted", undo };
}
