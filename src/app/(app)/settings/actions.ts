"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import bcrypt from "bcryptjs";

import { db } from "@/db";
import { appUser, people } from "@/db/schema";
import { requireUser } from "@/lib/dal";
import { str } from "@/lib/form-data";
import { hashPassword, validatePassword } from "@/lib/password";
import { ensurePersonForUser } from "@/lib/person-link";

export type FormState = { error?: string; ok?: boolean } | undefined;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Update the signed-in user's own profile — both the login (`app_user`: name +
 * email) and the linked roster record (`people`: student id, socials, notes).
 * Name and email are kept in sync across the two tables. Role/committee stay
 * admin-assigned and aren't editable here.
 */
export async function updateProfile(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const personId = await ensurePersonForUser(user);

  const name = str(fd, "name");
  const email = str(fd, "email")?.toLowerCase();

  if (!name) return { error: "Name is required." };
  if (!email) return { error: "Email is required." };
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };

  // Email is unique — reject if another account already uses it.
  const [clash] = await db
    .select({ id: appUser.id })
    .from(appUser)
    .where(and(eq(appUser.email, email), ne(appUser.id, user.id)))
    .limit(1);
  if (clash) return { error: "That email is already in use by another account." };

  await db
    .update(appUser)
    .set({ name, email, updatedAt: new Date().toISOString() })
    .where(eq(appUser.id, user.id));

  await db
    .update(people)
    .set({
      name,
      email,
      studentId: str(fd, "student_id"),
      discord: str(fd, "discord"),
      instagram: str(fd, "instagram"),
      github: str(fd, "github"),
      linkedin: str(fd, "linkedin"),
      website: str(fd, "website"),
      notes: str(fd, "notes"),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(people.id, personId));

  revalidatePath("/settings");
  revalidatePath("/people");
  revalidatePath("/", "layout"); // refresh the sidebar name/initials
  return { ok: true };
}

/** Change the signed-in user's password after verifying the current one. */
export async function changePassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();

  const current = (fd.get("current_password") as string | null) ?? "";
  const next = (fd.get("new_password") as string | null) ?? "";
  const confirm = (fd.get("confirm_password") as string | null) ?? "";

  if (!current || !next) return { error: "Fill in every password field." };
  const policyError = validatePassword(next);
  if (policyError) return { error: policyError };
  if (next !== confirm) return { error: "New password and confirmation don't match." };

  const [row] = await db
    .select({ passwordHash: appUser.passwordHash })
    .from(appUser)
    .where(eq(appUser.id, user.id))
    .limit(1);
  if (!row) return { error: "Account not found." };

  const valid = await bcrypt.compare(current, row.passwordHash);
  if (!valid) return { error: "Your current password is incorrect." };

  const passwordHash = await hashPassword(next);
  await db
    .update(appUser)
    .set({ passwordHash, updatedAt: new Date().toISOString() })
    .where(eq(appUser.id, user.id));

  return { ok: true };
}
