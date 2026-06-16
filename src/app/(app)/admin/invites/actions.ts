"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { appInvite, appRole, appUser } from "@/db/schema";
import { isKnownCommittee } from "@/lib/committee-queries";
import { requireAdmin } from "@/lib/dal";
import { getAppUrl, sendInviteEmail } from "@/lib/email";
import { int, str } from "@/lib/form-data";
import { createInviteToken } from "@/lib/tokens";

const INVITE_TTL_DAYS = 7;

export type InviteState =
  | { error: string }
  | { ok: true; email: string; link: string; sent: boolean; warning?: string }
  | undefined;

function expiryISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + INVITE_TTL_DAYS);
  return d.toISOString();
}

export async function createInvite(_prev: InviteState, fd: FormData): Promise<InviteState> {
  const admin = await requireAdmin();

  const email = str(fd, "email")?.toLowerCase();
  const roleId = int(fd, "role_id");
  const committee = str(fd, "committee");

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }
  if (!roleId) return { error: "Choose a role for this invite." };
  if (!(await isKnownCommittee(committee))) {
    return { error: "Choose a valid committee." };
  }

  const [role] = await db.select().from(appRole).where(eq(appRole.id, roleId)).limit(1);
  if (!role) return { error: "That role no longer exists." };

  const [existingUser] = await db
    .select({ id: appUser.id })
    .from(appUser)
    .where(eq(appUser.email, email))
    .limit(1);
  if (existingUser) {
    return { error: "Someone already has an account with that email." };
  }

  // Resolve the invite-link origin BEFORE writing anything — in production this
  // requires APP_URL (see getAppUrl), so fail cleanly rather than leaving an
  // orphan invite row if it's misconfigured.
  let origin: string;
  try {
    origin = await getAppUrl();
  } catch {
    return {
      error:
        "APP_URL isn't set, so invite links can't be built securely. Set APP_URL in the environment and try again.",
    };
  }

  // Supersede any earlier pending invites for the same address.
  await db
    .update(appInvite)
    .set({ status: "revoked" })
    .where(and(eq(appInvite.email, email), eq(appInvite.status, "pending")));

  const { raw, hash } = createInviteToken();
  await db.insert(appInvite).values({
    email,
    roleId,
    committee,
    tokenHash: hash,
    status: "pending",
    invitedBy: admin.email,
    expiresAt: expiryISO(),
  });

  const link = `${origin}/invite/${raw}`;
  const { sent, error } = await sendInviteEmail({
    to: email,
    link,
    roleName: role.name,
    committee,
    invitedBy: admin.name ?? admin.email,
  });

  revalidatePath("/admin/invites");
  return {
    ok: true,
    email,
    link,
    sent,
    warning: sent ? undefined : error ?? "Email isn't configured — copy the link below and share it.",
  };
}

export async function revokeInvite(id: number): Promise<void> {
  await requireAdmin();
  await db
    .update(appInvite)
    .set({ status: "revoked" })
    .where(and(eq(appInvite.id, id), eq(appInvite.status, "pending")));
  revalidatePath("/admin/invites");
  redirect("/admin/invites");
}
