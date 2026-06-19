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
import {
  archiveInviteSeededPerson,
  cleanupExpiredInvitePeople,
  ensurePersonForInvite,
} from "@/lib/person-link";
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
  const name = str(fd, "name");
  const roleId = int(fd, "role_id");
  const committee = str(fd, "committee");
  const roleTitle = str(fd, "role_title");

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

  // When the admin supplied a name, seed the roster immediately so the invitee
  // shows up in /people right away. On acceptance ensurePersonForUser matches
  // the same email and adopts this row, so there's no duplicate. Record the
  // person id only when we created a fresh row, so revoke/expiry cleanup can
  // remove it later without touching an existing member we merely adopted.
  let seededPersonId: number | null = null;
  if (name) {
    const seeded = await ensurePersonForInvite({ email, name, committee, roleTitle });
    if (seeded.created) seededPersonId = seeded.id;
  }

  const { raw, hash } = createInviteToken();
  await db.insert(appInvite).values({
    email,
    name,
    personId: seededPersonId,
    roleId,
    committee,
    roleTitle,
    tokenHash: hash,
    status: "pending",
    invitedBy: admin.email,
    expiresAt: expiryISO(),
  });

  // Opportunistically clear out roster ghosts left by invites that expired
  // unused — cheap, and keeps /people tidy without a separate cron.
  const swept = await cleanupExpiredInvitePeople();
  if (name || swept > 0) revalidatePath("/people");

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

  // Grab the seeded roster link before we clear it so we can tidy up the
  // provisional /people entry this invite created.
  const [inv] = await db
    .select({ status: appInvite.status, personId: appInvite.personId })
    .from(appInvite)
    .where(eq(appInvite.id, id))
    .limit(1);

  if (inv && inv.status === "pending") {
    await db
      .update(appInvite)
      .set({ status: "revoked", personId: null })
      .where(and(eq(appInvite.id, id), eq(appInvite.status, "pending")));

    // If this invite created a brand-new person and nobody has since signed in
    // against it, archive the ghost so /people doesn't keep a never-joined row.
    let archived = false;
    if (inv.personId != null) {
      archived = await archiveInviteSeededPerson(inv.personId);
    }
    if (archived) revalidatePath("/people");
  }

  revalidatePath("/admin/invites");
  redirect("/admin/invites");
}
