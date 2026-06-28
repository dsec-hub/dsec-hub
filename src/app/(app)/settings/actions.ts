"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import bcrypt from "bcryptjs";

import type { MediaState } from "@/app/(app)/media/actions";
import { db } from "@/db";
import { appUser, people } from "@/db/schema";
import { apiEnv } from "@/lib/api-env";
import { requireUser } from "@/lib/dal";
import { bool, str } from "@/lib/form-data";
import { hashPassword, validatePassword } from "@/lib/password";
import { ensurePersonForUser } from "@/lib/person-link";
import { revalidateWebsite } from "@/lib/revalidate-website";
import { getMedia } from "@/lib/workspace-queries";

export type FormState = { error?: string; ok?: boolean } | undefined;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Revalidate everywhere a member's own headshot is shown (their profile page,
 *  the roster, the sidebar avatar) plus the public team grid. */
async function revalidateOwnPhoto() {
  revalidatePath("/settings/profile");
  revalidatePath("/people");
  revalidatePath("/", "layout"); // sidebar avatar
  await revalidateWebsite("team");
}

/**
 * Upload the signed-in member's OWN profile headshot — self-service, scoped to
 * the person linked to their login (`ensurePersonForUser`), so it needs no
 * `people` write permission (mirrors `updateProfile`). The entity id is resolved
 * server-side from the session, never trusted from the form, so a member can
 * only ever set their own photo. Forwards the (already-cropped) image to
 * dsec-api `/media` as a person photo and refreshes the public team grid.
 *
 * Shaped as `(prevState, formData)` to drop straight into `<MediaManager
 * uploadAction={…}>`.
 */
export async function uploadOwnPhoto(_prev: MediaState, fd: FormData): Promise<MediaState> {
  const user = await requireUser();
  const personId = await ensurePersonForUser(user);

  const env = apiEnv();
  if (!env) {
    return { error: "Photo upload needs DSEC_API_URL and a write-scoped DSEC_API_KEY." };
  }

  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "No image to upload." };

  // Re-pack so only our fields reach the API — and pin entity_id to the
  // session-resolved person (ignore any client-supplied id).
  const body = new FormData();
  body.set("entity_type", "person");
  body.set("entity_id", String(personId));
  body.set("role", "photo");
  const alt = fd.get("alt_text");
  if (alt) body.set("alt_text", String(alt));
  body.set("file", file, file instanceof File ? file.name || "headshot.webp" : "headshot.webp");

  try {
    const res = await fetch(`${env.base}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.key}` },
      body,
    });
    if (!res.ok) {
      const detail = await res.text();
      return { error: `Upload failed (${res.status}): ${detail.slice(0, 200)}` };
    }
    await revalidateOwnPhoto();
    return { ok: "Photo uploaded." };
  } catch (e) {
    return { error: `Could not reach the API: ${(e as Error).message}` };
  }
}

/**
 * Delete one of the signed-in member's OWN profile photos. Object-level auth:
 * the asset must belong to the person linked to their login — the client-supplied
 * entity id is ignored, so a member can't delete anyone else's photo by passing a
 * different id. Shaped as `(id, entityType, entityId)` to match `<MediaManager
 * deleteAction={…}>`.
 */
export async function deleteOwnPhoto(
  id: number,
  _entityType: "event" | "project" | "sponsor" | "speaker" | "person" | "partner",
  _entityId: number,
): Promise<MediaState> {
  const user = await requireUser();
  const personId = await ensurePersonForUser(user);

  const env = apiEnv();
  if (!env) return { error: "Photo management needs DSEC_API_URL and DSEC_API_KEY." };

  // Re-bind the id to THIS user's person before deleting (the args are
  // client-supplied; the session person is the source of truth).
  const mine = await getMedia("person", personId);
  if (!mine.some((m) => m.id === id)) return { error: "That photo isn't on your profile." };

  try {
    const res = await fetch(`${env.base}/media/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${env.key}` },
    });
    if (!res.ok && res.status !== 404) {
      const detail = await res.text();
      return { error: `Delete failed (${res.status}): ${detail.slice(0, 200)}` };
    }
    await revalidateOwnPhoto();
    return { ok: "Photo removed." };
  } catch (e) {
    return { error: `Could not reach the API: ${(e as Error).message}` };
  }
}

/**
 * Update the signed-in user's own profile — the login name (`app_user`) and the
 * linked roster record (`people`: student id, socials, notes, public bio +
 * website visibility). This is self-service and only needs a signed-in user — no
 * `people` write permission — so view-only members can still maintain their own
 * details and choose whether to appear on the public team grid. Name is kept in
 * sync across the two tables. Email is a sign-in credential, so it's changed
 * separately via `changeEmail` (which re-verifies the password). Role/committee
 * and display order stay admin-assigned and aren't editable here.
 */
export async function updateProfile(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const personId = await ensurePersonForUser(user);

  const name = str(fd, "name");
  if (!name) return { error: "Name is required." };

  await db
    .update(appUser)
    .set({ name, updatedAt: new Date().toISOString() })
    .where(eq(appUser.id, user.id));

  await db
    .update(people)
    .set({
      name,
      studentId: str(fd, "student_id"),
      discord: str(fd, "discord"),
      instagram: str(fd, "instagram"),
      github: str(fd, "github"),
      linkedin: str(fd, "linkedin"),
      website: str(fd, "website"),
      notes: str(fd, "notes"),
      bio: str(fd, "bio"),
      showOnWebsite: bool(fd, "show_on_website"),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(people.id, personId));

  revalidatePath("/settings");
  revalidatePath("/people");
  revalidatePath("/", "layout"); // refresh the sidebar name/initials
  // The public roster (/website/team) is tagged "team" — refresh it so a
  // self-service publish/unpublish takes effect on the live site.
  await revalidateWebsite("team");
  return { ok: true };
}

/**
 * Change the signed-in user's sign-in email. Because the email is the credential
 * they log in with, an open session alone isn't enough — we re-verify the
 * current password before swapping it (same bar as `changePassword`). The new
 * address is format- and uniqueness-checked, then written to both the login
 * (`app_user`) and roster (`people`) records. No session patching is needed:
 * every request resolves the user by id and re-reads the email from the DB
 * (see `lib/dal.ts` → `getRealUser`), so the new address takes effect at once.
 */
export async function changeEmail(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const personId = await ensurePersonForUser(user);

  const email = str(fd, "email")?.toLowerCase();
  const password = (fd.get("current_password") as string | null) ?? "";

  if (!email) return { error: "Enter the new email address." };
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };
  if (!password) return { error: "Enter your current password to confirm." };
  if (email === user.email.toLowerCase()) {
    return { error: "That's already the email on your account." };
  }

  const [row] = await db
    .select({ passwordHash: appUser.passwordHash })
    .from(appUser)
    .where(eq(appUser.id, user.id))
    .limit(1);
  if (!row) return { error: "Account not found." };

  const valid = await bcrypt.compare(password, row.passwordHash);
  if (!valid) return { error: "Your current password is incorrect." };

  // Email is unique — reject if another account already uses it.
  const [clash] = await db
    .select({ id: appUser.id })
    .from(appUser)
    .where(and(eq(appUser.email, email), ne(appUser.id, user.id)))
    .limit(1);
  if (clash) return { error: "That email is already in use by another account." };

  const now = new Date().toISOString();
  await db.update(appUser).set({ email, updatedAt: now }).where(eq(appUser.id, user.id));
  await db.update(people).set({ email, updatedAt: now }).where(eq(people.id, personId));

  revalidatePath("/settings");
  revalidatePath("/people");
  revalidatePath("/", "layout"); // refresh the sidebar (name/initials derive from email fallback)
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
