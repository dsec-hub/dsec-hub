import "server-only";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { eq, getTableColumns } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import bcrypt from "bcryptjs";

import { db } from "@/db";
import { appRole, appSetting, appUser, committee, events, finance, people, sponsors } from "@/db/schema";
import {
  documents,
  eventConnections,
  eventPartners,
  eventSpeakers,
  eventSponsors,
  links,
  meetings,
  partners,
  projects,
  scanTargets,
  taskBoards,
  tasks,
} from "@/db/workspace-schema";
import type { ModuleKey } from "@/lib/rbac";
import { signToken } from "@/lib/undo-sign";
import type { UndoKey, UndoToken } from "@/lib/undo-types";

type Reg = {
  table: PgTable;
  module: ModuleKey; // who may perform (and therefore undo) this op
  label: string; // human label, e.g. "Event"
  paths: string[]; // routes to revalidate after an undo restores data
};

/**
 * Every undoable table, keyed by the token's `key`. The `module` is re-checked
 * server-side in `performUndo`, so a client-supplied token can never reverse a
 * mutation the caller couldn't have made in the first place.
 */
export const REGISTRY: Record<UndoKey, Reg> = {
  event: { table: events, module: "events", label: "Event", paths: ["/events", "/events/dusa", "/dashboard", "/"] },
  event_speaker: { table: eventSpeakers, module: "events", label: "Speaker", paths: ["/events"] },
  event_sponsor: { table: eventSponsors, module: "events", label: "Event sponsor", paths: ["/events"] },
  event_partner: { table: eventPartners, module: "events", label: "Event partner", paths: ["/events"] },
  event_connection: { table: eventConnections, module: "events", label: "Event connection", paths: ["/events"] },
  finance: { table: finance, module: "finance", label: "Finance entry", paths: ["/finance", "/dashboard", "/"] },
  person: { table: people, module: "people", label: "Person", paths: ["/people", "/dashboard", "/"] },
  sponsor: { table: sponsors, module: "sponsors", label: "Sponsor", paths: ["/sponsors", "/dashboard", "/"] },
  partner: { table: partners, module: "partners", label: "Partner", paths: ["/partners", "/dashboard", "/"] },
  project: { table: projects, module: "projects", label: "Project", paths: ["/projects", "/dashboard", "/"] },
  task: { table: tasks, module: "tasks", label: "Task", paths: ["/tasks", "/dashboard", "/"] },
  board: { table: taskBoards, module: "tasks", label: "Board", paths: ["/tasks", "/dashboard", "/"] },
  document: { table: documents, module: "documents", label: "Document", paths: ["/docs", "/dashboard", "/"] },
  meeting: { table: meetings, module: "meetings", label: "Meeting", paths: ["/meetings", "/dashboard", "/"] },
  link: { table: links, module: "links", label: "Link", paths: ["/links", "/dashboard", "/"] },
  scan_target: { table: scanTargets, module: "scan", label: "Scan card", paths: ["/scan", "/dashboard", "/"] },
  user: { table: appUser, module: "admin", label: "User", paths: ["/admin/users"] },
  role: { table: appRole, module: "admin", label: "Role", paths: ["/admin/roles", "/admin/users"] },
  committee: {
    table: committee,
    module: "admin",
    label: "Committee",
    paths: ["/admin/committees", "/people", "/events", "/tasks", "/dashboard", "/"],
  },
};

/** drizzle's table generics don't survive a registry lookup, so the query
 * builders below take the runtime table object through a deliberately loose
 * cast. The column set is still derived from the real table for filtering. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseTable = any;

/** Keep only keys that are real columns of `table` (drops anything a crafted
 * client token might smuggle in, and any read-only/extra props). */
function pickColumns(table: PgTable, row: Record<string, unknown>): Record<string, unknown> {
  const allowed = new Set(Object.keys(getTableColumns(table)));
  return Object.fromEntries(Object.entries(row).filter(([k]) => allowed.has(k)));
}

function idColumn(table: PgTable) {
  return getTableColumns(table).id;
}

/**
 * SEC-15: per-table column denylist. Undo tokens round-trip through the browser
 * and the payload is base64url JSON — signed (tamper-evident) but NOT encrypted,
 * so anyone holding the token can read the snapshot inside. `readRow` strips
 * these columns from every snapshot BEFORE it is signed, so a secret never rides
 * an undo token to the client. Applied inside `readRow` (not at the call sites)
 * so the dynamic-key `/archive` path is covered for free.
 *
 * Keys are the Drizzle JS column names — what `db.select()` returns and what
 * `pickColumns` filters on — NOT the snake_case DB names. `placeholder`, when
 * set, supplies a safe value re-inserted on a DELETE-restore for a NOT-NULL
 * column that was stripped on capture (see `applyUndo`); a nullable denied
 * column needs none (absent on restore just leaves it NULL).
 *
 * Every one of REGISTRY's 19 tables was audited; only these two carry a secret:
 *   user    → passwordHash      (app_user.password_hash — NOT NULL, len 512)
 *   meeting → agendaShareToken  (meeting.agenda_share_token — nullable, len 64;
 *                                a share-link capability token, safe to drop on
 *                                restore since it is nullable)
 * api_key.key_hash and app_invite.token_hash are also secrets, but their tables
 * are NOT in REGISTRY (unreachable via undo), so they are deliberately absent.
 */
type DeniedColumn = { placeholder?: () => Promise<unknown> | unknown };

/**
 * A valid but unusable bcrypt hash of a random, immediately-discarded secret.
 * Lets a deleted user row restore without violating `password_hash` NOT NULL and
 * without leaking (or guessably reconstructing) the real hash — the account is
 * non-loginable until an admin resets its password. `crypto.randomBytes` (never
 * `Math.random`) makes the discarded input unguessable; cost 12 matches the
 * repo's password policy (lib/password.ts).
 */
async function unusablePasswordHash(): Promise<string> {
  return bcrypt.hash(randomBytes(32).toString("hex"), 12);
}

const COLUMN_DENYLIST: Partial<Record<UndoKey, Record<string, DeniedColumn>>> = {
  user: { passwordHash: { placeholder: unusablePasswordHash } },
  meeting: { agendaShareToken: {} },
};

async function readRow(key: UndoKey, id: number): Promise<Record<string, unknown> | undefined> {
  const { table } = REGISTRY[key];
  const [row] = await db
    .select()
    .from(table as LooseTable)
    .where(eq(idColumn(table), id))
    .limit(1);
  if (!row) return undefined;
  // Drop denied columns before the snapshot is signed + handed to the browser.
  const denied = COLUMN_DENYLIST[key];
  if (denied) {
    for (const col of Object.keys(denied)) {
      delete (row as Record<string, unknown>)[col];
    }
  }
  return row as Record<string, unknown>;
}

// The snapshot/create helpers return a SIGNED token string (see undo-sign.ts) so
// the snapshot can't be tampered with on its round-trip through the client.

/** Snapshot a row so a later hard delete can be reversed. Call BEFORE deleting. */
export async function snapshotForDelete(key: UndoKey, id: number): Promise<string | undefined> {
  const row = await readRow(key, id);
  return row ? signToken({ op: "delete", key, row }) : undefined;
}

/** Snapshot prior values so an update/archive can be reversed. Call BEFORE updating. */
export async function snapshotForUpdate(key: UndoKey, id: number): Promise<string | undefined> {
  const row = await readRow(key, id);
  return row ? signToken({ op: "update", key, id, prev: row }) : undefined;
}

/** Build a token that reverses a create by deleting the freshly-inserted row. */
export function createToken(key: UndoKey, id: number | undefined | null): string | undefined {
  return id == null ? undefined : signToken({ op: "create", key, id });
}

/** Token that reverses an archive — restores `archived = false` on the row. */
export function archiveToken(key: UndoKey, id: number): string {
  return signToken({ op: "update", key, id, prev: { archived: false } });
}

/**
 * Apply the inverse of a recorded mutation. Internal — assumes the caller has
 * already authorized (see `performUndo`). Throws on DB error so the action
 * layer can report a friendly failure.
 */
export async function applyUndo(token: UndoToken): Promise<void> {
  if (token.op === "settings") {
    for (const [key, value] of Object.entries(token.prev)) {
      await db
        .insert(appSetting)
        .values({ key, value })
        .onConflictDoUpdate({
          target: appSetting.key,
          set: { value, updatedAt: new Date().toISOString() },
        });
    }
    token.paths.forEach((p) => revalidatePath(p));
    return;
  }

  const reg = REGISTRY[token.key];
  const { table } = reg;

  if (token.op === "create") {
    // reverse a create → remove the row we inserted
    await db.delete(table as LooseTable).where(eq(idColumn(table), token.id));
  } else if (token.op === "update") {
    // reverse an update/archive → restore the prior column values
    await db
      .update(table as LooseTable)
      .set(pickColumns(table, token.prev))
      .where(eq(idColumn(table), token.id));
  } else {
    // reverse a hard delete → re-insert the captured row (same id). A secret
    // column stripped on capture (COLUMN_DENYLIST) is absent from the snapshot;
    // if it is NOT NULL the insert would throw, turning undo into permanent data
    // loss — so re-supply a safe placeholder. Denylist-driven, not a one-off:
    // today only user.passwordHash carries a placeholder and so actually fires.
    const values = pickColumns(table, token.row);
    const denied = COLUMN_DENYLIST[token.key];
    if (denied) {
      for (const [col, meta] of Object.entries(denied)) {
        if (meta.placeholder && !(col in values)) {
          values[col] = await meta.placeholder();
        }
      }
    }
    await db.insert(table as LooseTable).values(values);
  }

  reg.paths.forEach((p) => revalidatePath(p));
}
