"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { requireWrite, type CurrentUser } from "@/lib/dal";
import { canWriteCommittee } from "@/lib/rbac";
import { committeeScopeOf } from "@/lib/scope";
import { REGISTRY, snapshotForDelete, snapshotForUpdate } from "@/lib/undo";
import type { ActionResult, UndoKey } from "@/lib/undo-types";
import { logMutation } from "@/lib/usage";

// drizzle's table generics don't survive a REGISTRY lookup, so the DB ops below
// reach the runtime table object through a deliberately loose cast — the same
// pattern lib/undo.ts uses. Both the table and its `archived`/`id`/`committee`
// columns are physically identical across the entity's schema definitions.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseTable = any;

/**
 * The content entities the Archive view may Restore / Delete. Each is a
 * REGISTRY key, so we look up its table + owning module + revalidation paths
 * there rather than re-declaring them. Anything not in this set is rejected even
 * if it happens to be a valid undo key (e.g. user/role/committee).
 */
const ARCHIVABLE = new Set<UndoKey>([
  "event",
  "task",
  "board",
  "project",
  "meeting",
  "document",
  "person",
  "partner",
  "sponsor",
  "finance",
  "link",
]);

function lookup(key: UndoKey) {
  if (!ARCHIVABLE.has(key)) throw new Error("Not an archivable item.");
  return REGISTRY[key];
}

/**
 * Meetings + documents are committee-scoped: a viewer without "all" scope may
 * only act on their own committee's (or club-wide) records. The list query
 * already hides others; this blocks a forged/stale request from reaching one.
 * Mirrors the guard in meetings/actions.ts.
 */
async function assertCommitteeWrite(
  user: CurrentUser,
  key: UndoKey,
  table: LooseTable,
  id: number,
): Promise<void> {
  if (key !== "meeting" && key !== "document") return;
  const [row] = await db
    .select({ committee: table.committee })
    .from(table)
    .where(eq(table.id, id))
    .limit(1);
  if (!row) return;
  const scope = committeeScopeOf(user);
  if (!canWriteCommittee(scope.all ? "all" : "own", scope.committee, row.committee)) {
    throw new Error("You can only manage your own committee's items.");
  }
}

/** Bring an archived item back — flips `archived` to false. Reversible via the
 * undo toast (the snapshot restores the prior row, re-archiving it). */
export async function restoreItem(key: UndoKey, id: number): Promise<ActionResult> {
  const reg = lookup(key);
  const user = await requireWrite(reg.module);
  const table = reg.table as LooseTable;
  await assertCommitteeWrite(user, key, table, id);

  const undo = await snapshotForUpdate(key, id);
  await db.update(table).set({ archived: false }).where(eq(table.id, id));
  await logMutation(user, "update", key, id, "restore");
  reg.paths.forEach((p) => revalidatePath(p));
  revalidatePath("/archive");
  return { ok: true, message: `${reg.label} restored`, undo };
}

/** Permanently remove an archived item. The pre-delete snapshot lets the undo
 * toast re-insert it (same id) for a brief window; a foreign-key conflict leaves
 * the row untouched and reports a friendly error instead of crashing. */
export async function deleteItem(key: UndoKey, id: number): Promise<ActionResult> {
  const reg = lookup(key);
  const user = await requireWrite(reg.module);
  const table = reg.table as LooseTable;
  await assertCommitteeWrite(user, key, table, id);

  const undo = await snapshotForDelete(key, id);
  try {
    await db.delete(table).where(eq(table.id, id));
  } catch {
    return {
      error: `Couldn't delete this ${reg.label.toLowerCase()} — it's still linked to other records. It stays archived.`,
    };
  }
  await logMutation(user, "delete", key, id);
  reg.paths.forEach((p) => revalidatePath(p));
  revalidatePath("/archive");
  return { ok: true, message: `${reg.label} deleted`, undo };
}
