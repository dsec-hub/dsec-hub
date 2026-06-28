"use server";

import { revalidatePath } from "next/cache";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { linkProfile, links } from "@/db/workspace-schema";
import { requireWrite } from "@/lib/dal";
import { bool, str } from "@/lib/form-data";
import { LINK_ACCENT_VALUES } from "@/lib/options";
import { revalidateWebsite } from "@/lib/revalidate-website";
import { archiveToken, createToken, snapshotForDelete, snapshotForUpdate } from "@/lib/undo";
import type { ActionResult } from "@/lib/undo-types";
import { logMutation } from "@/lib/usage";

export type FormState = ActionResult;

function parseLink(fd: FormData) {
  const accent = str(fd, "accent");
  return {
    title: str(fd, "title") ?? "",
    subtitle: str(fd, "subtitle"),
    url: str(fd, "url") ?? "",
    icon: str(fd, "icon"),
    accent: accent && LINK_ACCENT_VALUES.includes(accent) ? accent : null,
    isVisible: bool(fd, "is_visible"),
  };
}

const URL_ERROR = "Enter a valid URL (http(s), mailto, tel, or a /path).";

/** Accept a relative `/path` or an absolute http(s)/mailto/tel URL. Returns an
 * error message string if the (trimmed) url is empty, too long, or unsupported. */
function validateLinkUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed || trimmed.length > 2048) return URL_ERROR;
  if (!trimmed.startsWith("/") && !/^(https?|mailto|tel):/i.test(trimmed)) return URL_ERROR;
  return null;
}

// The link tree surfaces on the public website's chromeless /links page, so a
// write flushes that feed (tag "links") as well as the dashboard routes.
async function revalidateLinks() {
  revalidatePath("/links");
  revalidatePath("/dashboard");
  revalidatePath("/");
  await revalidateWebsite("links");
}

export async function createLink(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireWrite("links");
  const values = parseLink(fd);
  if (!values.title) return { error: "Title is required." };
  if (!values.url) return { error: "URL is required." };
  const urlError = validateLinkUrl(values.url);
  if (urlError) return { error: urlError };
  // New links land at the bottom of the stack.
  const [last] = await db
    .select({ displayOrder: links.displayOrder })
    .from(links)
    .where(eq(links.archived, false))
    .orderBy(desc(links.displayOrder))
    .limit(1);
  const displayOrder = last ? last.displayOrder + 1 : 0;
  const [row] = await db
    .insert(links)
    .values({ ...values, displayOrder })
    .returning({ id: links.id });
  await logMutation(user, "create", "link", row?.id);
  await revalidateLinks();
  return { ok: true, message: "Link created", undo: createToken("link", row?.id), id: row?.id };
}

export async function updateLink(
  id: number,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const user = await requireWrite("links");
  const values = parseLink(fd);
  if (!values.title) return { error: "Title is required." };
  if (!values.url) return { error: "URL is required." };
  const urlError = validateLinkUrl(values.url);
  if (urlError) return { error: urlError };
  const undo = await snapshotForUpdate("link", id);
  await db
    .update(links)
    .set({ ...values, updatedAt: new Date().toISOString() })
    .where(eq(links.id, id));
  await logMutation(user, "update", "link", id);
  await revalidateLinks();
  return { ok: true, message: "Link updated", undo };
}

export async function archiveLink(id: number): Promise<FormState> {
  const user = await requireWrite("links");
  await db
    .update(links)
    .set({ archived: true, updatedAt: new Date().toISOString() })
    .where(eq(links.id, id));
  await logMutation(user, "archive", "link", id);
  await revalidateLinks();
  return { ok: true, message: "Link archived", undo: archiveToken("link", id) };
}

export async function deleteLink(id: number): Promise<FormState> {
  const user = await requireWrite("links");
  const undo = await snapshotForDelete("link", id);
  await db.delete(links).where(eq(links.id, id));
  await logMutation(user, "delete", "link", id);
  await revalidateLinks();
  return { ok: true, message: "Link deleted", undo };
}

/** Persist a new ordering: each id's display_order becomes its array index. */
export async function reorderLinks(orderedIds: number[]): Promise<FormState> {
  const user = await requireWrite("links");
  const now = new Date().toISOString();
  await Promise.all(
    orderedIds.map((id, index) =>
      db.update(links).set({ displayOrder: index, updatedAt: now }).where(eq(links.id, id)),
    ),
  );
  await logMutation(user, "update", "link", null, "reorder");
  await revalidateLinks();
  return { ok: true };
}

export async function saveLinkProfile(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireWrite("links");
  const title = str(fd, "title") ?? "DSEC";
  const tagline = str(fd, "tagline");
  const mascot = str(fd, "mascot");
  // Singleton row id = 1 — upsert so the first save creates it.
  await db
    .insert(linkProfile)
    .values({ id: 1, title, tagline, mascot })
    .onConflictDoUpdate({
      target: linkProfile.id,
      set: { title, tagline, mascot, updatedAt: new Date().toISOString() },
    });
  await logMutation(user, "update", "link_profile", 1);
  await revalidateLinks();
  return { ok: true, message: "Profile saved" };
}
