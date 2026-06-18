"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { appRole } from "@/db/schema";
import { getRealUser } from "@/lib/dal";
import { isAdmin } from "@/lib/rbac";
import { PREVIEW_COOKIE, signPreview } from "@/lib/role-preview";

/** Start previewing a role. Gated on the REAL admin (never the overlaid user),
 * and refuses to preview an admin role (no narrowing → no point). */
export async function setPreviewRole(roleId: number): Promise<void> {
  const real = await getRealUser();
  if (!real || !isAdmin(real.modules)) return;

  const [role] = await db
    .select({ id: appRole.id, modules: appRole.modules })
    .from(appRole)
    .where(eq(appRole.id, roleId))
    .limit(1);
  if (!role) return;
  if (isAdmin(Array.isArray(role.modules) ? role.modules : [])) return;

  (await cookies()).set(PREVIEW_COOKIE, signPreview(role.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 3600,
  });
  revalidatePath("/", "layout");
}

/** Exit preview. Safe for anyone — clearing only ever de-escalates. */
export async function clearPreviewRole(): Promise<void> {
  (await cookies()).delete(PREVIEW_COOKIE);
  revalidatePath("/", "layout");
}
