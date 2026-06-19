"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { appUser, people } from "@/db/schema";
import { apiEnv } from "@/lib/api-env";
import { requireUser } from "@/lib/dal";
import { ensurePersonForUser } from "@/lib/person-link";
import { revalidateWebsite } from "@/lib/revalidate-website";
import { getMedia, getMemberByStudentId } from "@/lib/workspace-queries";

export type OnboardingState = { error?: string; ok?: boolean } | undefined;

const LINK_FIELDS = ["website", "discord", "instagram", "github", "linkedin"] as const;

// A DUSA/Deakin student ID is numeric (commonly 9 digits). Kept lenient (6–12)
// so unusual lengths still pass; the live roster lookup is the real check. The
// wizard mirrors this exact pattern for its per-step gate.
const STUDENT_ID_RE = /^\d{6,12}$/;

function normaliseStudentId(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "");
}

export type OnboardingProfile = {
  name: string;
  bio: string;
  studentId: string;
  website: string;
  discord: string;
  instagram: string;
  github: string;
  linkedin: string;
};

/**
 * Self-scoped profile-photo upload for the onboarding wizard. The People media
 * manager requires write access to the `people` module; this deliberately does
 * not — it only ever targets the signed-in user's OWN roster record, so any
 * active member can set their headshot during first-run setup. To keep the
 * headshot a single image, any previous person photos are removed after the new
 * one lands (upload first, then delete, so a failed upload never loses the old).
 */
export async function uploadOwnPhoto(
  _prev: OnboardingState,
  fd: FormData,
): Promise<OnboardingState> {
  const user = await requireUser();
  const personId = await ensurePersonForUser(user);

  const env = apiEnv();
  if (!env) {
    return {
      error:
        "Photo upload isn't configured yet (needs DSEC_API_URL + a write-scoped DSEC_API_KEY). Ask an admin.",
    };
  }

  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "No image to upload." };

  const previous = await getMedia("person", personId);

  const body = new FormData();
  body.set("entity_type", "person");
  body.set("entity_id", String(personId));
  body.set("role", "photo");
  body.set("file", file, file.name || "photo.webp");

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
    // Drop the earlier headshots now the new one is stored (best-effort).
    for (const m of previous) {
      await fetch(`${env.base}/media/${m.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${env.key}` },
      }).catch(() => {});
    }
    revalidatePath("/onboarding");
    await revalidateWebsite("team");
    return { ok: true };
  } catch (e) {
    return { error: `Could not reach the API: ${(e as Error).message}` };
  }
}

/**
 * Result of a live DUSA-roster lookup for a typed student ID. `found` carries
 * just enough to reassure the new member (status + a short faculty/campus line),
 * never the matched person's name — committee can already see that on /members.
 */
export type MembershipCheck =
  | { status: "found"; isCurrent: boolean; dusaMember: boolean; detail: string }
  | { status: "not_found" }
  | { status: "invalid" };

/**
 * Live, self-service membership check for the onboarding wizard's Membership
 * step. Any signed-in member may look up a student ID against the imported DUSA
 * roster (the same data committee browses on /members), so this needs no extra
 * scope. It never blocks onboarding — a "not_found" simply means the new member
 * hasn't landed in a weekly report yet.
 */
export async function checkMembership(studentId: string): Promise<MembershipCheck> {
  await requireUser();
  const id = normaliseStudentId(studentId);
  if (!STUDENT_ID_RE.test(id)) return { status: "invalid" };

  const member = await getMemberByStudentId(id);
  if (!member) return { status: "not_found" };

  const detail =
    [member.faculty, member.campus, member.membershipType].filter(Boolean).join(" · ") || "";
  return {
    status: "found",
    isCurrent: !!member.isCurrent,
    dusaMember: !!member.dusaMember,
    detail,
  };
}

/**
 * Persist the collected profile, mark onboarding complete, and enter the app.
 * Required fields are validated here too (defense in depth — the wizard also
 * gates them): full name, a short bio, a student ID, at least one link, and a
 * profile photo. Email and role stay as the invite assigned them; not edited here.
 */
export async function finishOnboarding(data: OnboardingProfile): Promise<OnboardingState> {
  const user = await requireUser();
  const personId = await ensurePersonForUser(user);

  const name = data.name?.trim();
  const bio = data.bio?.trim();
  if (!name) return { error: "Please add your full name." };
  if (!bio) return { error: "Please add a short bio for the team page." };

  const studentId = normaliseStudentId(data.studentId);
  if (!STUDENT_ID_RE.test(studentId)) {
    return { error: "Please add your student ID so we can verify your club membership." };
  }

  const links = Object.fromEntries(
    LINK_FIELDS.map((k) => [k, (data[k] ?? "").trim()]),
  ) as Record<(typeof LINK_FIELDS)[number], string>;
  if (!Object.values(links).some(Boolean)) {
    return { error: "Add at least one link so people can reach you." };
  }

  // Photo is required — re-check against the DB (set by the upload step).
  const photos = await getMedia("person", personId);
  if (!photos.length) return { error: "Please add a profile photo before finishing." };

  await db
    .update(people)
    .set({
      name,
      bio,
      studentId,
      website: links.website || null,
      discord: links.discord || null,
      instagram: links.instagram || null,
      github: links.github || null,
      linkedin: links.linkedin || null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(people.id, personId));

  await db
    .update(appUser)
    .set({
      name,
      onboardingCompletedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(appUser.id, user.id));

  revalidatePath("/", "layout"); // sidebar name/initials
  revalidatePath("/settings");
  revalidatePath("/people");
  await revalidateWebsite("team");

  redirect("/dashboard");
}
