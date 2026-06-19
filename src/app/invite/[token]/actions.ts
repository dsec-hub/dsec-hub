"use server";

import { and, eq, gt } from "drizzle-orm";
import { AuthError } from "next-auth";

import { signIn } from "@/auth";
import { db } from "@/db";
import { appInvite, appRole, appUser } from "@/db/schema";
import { str } from "@/lib/form-data";
import { hashPassword, validatePassword } from "@/lib/password";
import { ensurePersonForUser } from "@/lib/person-link";
import { hashToken } from "@/lib/tokens";

export type AcceptState = { error?: string } | undefined;

/** Look up a still-valid (pending, unexpired) invite by its raw token. */
export async function findValidInvite(rawToken: string) {
  const [invite] = await db
    .select({
      id: appInvite.id,
      email: appInvite.email,
      name: appInvite.name,
      roleId: appInvite.roleId,
      roleName: appRole.name,
      committee: appInvite.committee,
      roleTitle: appInvite.roleTitle,
    })
    .from(appInvite)
    .leftJoin(appRole, eq(appInvite.roleId, appRole.id))
    .where(
      and(
        eq(appInvite.tokenHash, hashToken(rawToken)),
        eq(appInvite.status, "pending"),
        gt(appInvite.expiresAt, new Date().toISOString()),
      ),
    )
    .limit(1);
  return invite;
}

export async function acceptInvite(
  rawToken: string,
  _prev: AcceptState,
  fd: FormData,
): Promise<AcceptState> {
  const invite = await findValidInvite(rawToken);
  if (!invite) {
    return { error: "This invite is no longer valid. Ask an admin for a new one." };
  }

  const name = str(fd, "name");
  const password = str(fd, "password") ?? "";
  const confirm = str(fd, "confirm") ?? "";

  const policyError = validatePassword(password);
  if (policyError) return { error: policyError };
  if (password !== confirm) return { error: "Passwords don't match." };

  const passwordHash = await hashPassword(password);

  // Create or re-activate the account, then mark the invite accepted.
  const [existing] = await db
    .select({ id: appUser.id })
    .from(appUser)
    .where(eq(appUser.email, invite.email))
    .limit(1);

  let userId: number;
  if (existing) {
    await db
      .update(appUser)
      .set({
        passwordHash,
        name: name ?? undefined,
        roleId: invite.roleId,
        role: invite.roleName ?? "exec",
        isActive: true,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(appUser.id, existing.id));
    userId = existing.id;
  } else {
    const [created] = await db
      .insert(appUser)
      .values({
        email: invite.email,
        name: name ?? null,
        passwordHash,
        roleId: invite.roleId,
        role: invite.roleName ?? "exec",
        isActive: true,
      })
      .returning({ id: appUser.id });
    userId = created.id;
  }

  // Link (or create) the roster record so the login and its People entry stay
  // in sync — matched by email, else a new person is created.
  await ensurePersonForUser({
    id: userId,
    email: invite.email,
    name,
    committee: invite.committee,
    roleTitle: invite.roleTitle,
  });

  await db
    .update(appInvite)
    .set({ status: "accepted", acceptedAt: new Date().toISOString() })
    .where(eq(appInvite.id, invite.id));

  // Sign the new user straight in (throws a redirect on success).
  try {
    await signIn("credentials", {
      email: invite.email,
      password,
      // New accounts land in the first-run wizard. The (app) layout would force
      // this anyway (onboarding_completed_at is null on a fresh account); sending
      // them here directly just skips the bounce.
      redirectTo: "/onboarding",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Account created, but sign-in failed. Try the sign-in page." };
    }
    throw error;
  }
  return undefined;
}
