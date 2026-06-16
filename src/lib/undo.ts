import "server-only";

import { revalidatePath } from "next/cache";
import { eq, getTableColumns } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

import { db } from "@/db";
import { appRole, appSetting, appUser, committee, events, finance, people, sponsors } from "@/db/schema";
import {
  eventConnections,
  eventPartners,
  eventSpeakers,
  eventSponsors,
  partners,
  projects,
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

async function readRow(key: UndoKey, id: number): Promise<Record<string, unknown> | undefined> {
  const { table } = REGISTRY[key];
  const [row] = await db
    .select()
    .from(table as LooseTable)
    .where(eq(idColumn(table), id))
    .limit(1);
  return row as Record<string, unknown> | undefined;
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
    // reverse a hard delete → re-insert the captured row (same id)
    await db.insert(table as LooseTable).values(pickColumns(table, token.row));
  }

  reg.paths.forEach((p) => revalidatePath(p));
}
