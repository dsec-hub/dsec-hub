"use server";

import { revalidatePath } from "next/cache";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { scanPage, scanTargets } from "@/db/workspace-schema";
import { requireWrite } from "@/lib/dal";
import { bool, str } from "@/lib/form-data";
import { SCAN_ACCENT_VALUES } from "@/lib/options";
import { revalidateWebsite } from "@/lib/revalidate-website";
import { archiveToken, createToken, snapshotForDelete, snapshotForUpdate } from "@/lib/undo";
import type { ActionResult } from "@/lib/undo-types";
import { logMutation } from "@/lib/usage";

export type FormState = ActionResult;

function parseScan(fd: FormData) {
  const accent = str(fd, "accent");
  return {
    label: str(fd, "label") ?? "",
    caption: str(fd, "caption"),
    url: str(fd, "url") ?? "",
    pretty: str(fd, "pretty"),
    accent: accent && SCAN_ACCENT_VALUES.includes(accent) ? accent : null,
    isVisible: bool(fd, "is_visible"),
  };
}

const URL_ERROR =
  "Enter an absolute URL the QR can encode (https://…, mailto: or tel: — not a /path).";

/** A scan QR can only encode an absolute destination — http(s)/mailto/tel (a
 * phone camera can't resolve a relative /path). Returns an error message or null. */
function validateScanUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed || trimmed.length > 2048) return URL_ERROR;
  if (!/^(https?|mailto|tel):/i.test(trimmed)) return URL_ERROR;
  return null;
}

// The scan wall surfaces on the public website's /scan page, so a write flushes
// that feed (tag "scan") as well as the dashboard routes.
async function revalidateScan() {
  revalidatePath("/scan");
  revalidatePath("/dashboard");
  revalidatePath("/");
  await revalidateWebsite("scan");
}

export async function createScanTarget(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireWrite("scan");
  const values = parseScan(fd);
  if (!values.label) return { error: "Label is required." };
  if (!values.url) return { error: "URL is required." };
  const urlError = validateScanUrl(values.url);
  if (urlError) return { error: urlError };
  // New cards land at the bottom of the wall.
  const [last] = await db
    .select({ displayOrder: scanTargets.displayOrder })
    .from(scanTargets)
    .where(eq(scanTargets.archived, false))
    .orderBy(desc(scanTargets.displayOrder))
    .limit(1);
  const displayOrder = last ? last.displayOrder + 1 : 0;
  const [row] = await db
    .insert(scanTargets)
    .values({ ...values, displayOrder })
    .returning({ id: scanTargets.id });
  await logMutation(user, "create", "scan_target", row?.id);
  await revalidateScan();
  return { ok: true, message: "Card created", undo: createToken("scan_target", row?.id), id: row?.id };
}

export async function updateScanTarget(
  id: number,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const user = await requireWrite("scan");
  const values = parseScan(fd);
  if (!values.label) return { error: "Label is required." };
  if (!values.url) return { error: "URL is required." };
  const urlError = validateScanUrl(values.url);
  if (urlError) return { error: urlError };
  const undo = await snapshotForUpdate("scan_target", id);
  await db
    .update(scanTargets)
    .set({ ...values, updatedAt: new Date().toISOString() })
    .where(eq(scanTargets.id, id));
  await logMutation(user, "update", "scan_target", id);
  await revalidateScan();
  return { ok: true, message: "Card updated", undo };
}

export async function archiveScanTarget(id: number): Promise<FormState> {
  const user = await requireWrite("scan");
  await db
    .update(scanTargets)
    .set({ archived: true, updatedAt: new Date().toISOString() })
    .where(eq(scanTargets.id, id));
  await logMutation(user, "archive", "scan_target", id);
  await revalidateScan();
  return { ok: true, message: "Card archived", undo: archiveToken("scan_target", id) };
}

export async function deleteScanTarget(id: number): Promise<FormState> {
  const user = await requireWrite("scan");
  const undo = await snapshotForDelete("scan_target", id);
  await db.delete(scanTargets).where(eq(scanTargets.id, id));
  await logMutation(user, "delete", "scan_target", id);
  await revalidateScan();
  return { ok: true, message: "Card deleted", undo };
}

/** Persist a new ordering: each id's display_order becomes its array index. */
export async function reorderScanTargets(orderedIds: number[]): Promise<FormState> {
  const user = await requireWrite("scan");
  const now = new Date().toISOString();
  await Promise.all(
    orderedIds.map((id, index) =>
      db.update(scanTargets).set({ displayOrder: index, updatedAt: now }).where(eq(scanTargets.id, id)),
    ),
  );
  await logMutation(user, "update", "scan_target", null, "reorder");
  await revalidateScan();
  return { ok: true };
}

/** Save the singleton /scan header (the big title + one-line description shown
 * above the QR cards). A blank field is stored as null so the public page falls
 * back to the built-in default copy. Upserts row id = 1 so the first save creates
 * it. */
export async function saveScanPage(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireWrite("scan");
  // str() trims and returns null for an empty field, so clearing a field stores
  // null (→ the default copy shows again on the public page).
  const title = str(fd, "title");
  const description = str(fd, "description");
  if (title && title.length > 120) return { error: "Title must be 120 characters or fewer." };
  if (description && description.length > 300) {
    return { error: "Description must be 300 characters or fewer." };
  }

  await db
    .insert(scanPage)
    .values({ id: 1, title, description })
    .onConflictDoUpdate({
      target: scanPage.id,
      set: { title, description, updatedAt: new Date().toISOString() },
    });
  await logMutation(user, "update", "scan_page", 1);
  await revalidateScan();
  return { ok: true, message: "Heading saved" };
}
