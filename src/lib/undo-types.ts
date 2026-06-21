/**
 * Serializable "undo token" describing how to reverse a single mutation. An
 * undoable server action returns one of these to the client; the Sonner toast's
 * "Undo" button hands it straight back to `performUndo`. Tokens must stay plain
 * JSON (no Date objects, no class instances) so they survive the
 * server → client → server round-trip — our timestamp columns are already
 * `mode: "string"`, numerics/dates serialize as strings, and json columns as
 * arrays/objects, so a snapshotted row is JSON-safe as-is.
 */

/** Registry keys for undoable tables — keep in sync with REGISTRY in undo.ts. */
export type UndoKey =
  | "event"
  | "event_speaker"
  | "event_sponsor"
  | "event_partner"
  | "event_connection"
  | "finance"
  | "person"
  | "sponsor"
  | "partner"
  | "project"
  | "task"
  | "board"
  | "document"
  | "user"
  | "role"
  | "committee";

type Row = Record<string, unknown>;

export type UndoToken =
  // reverse a create → delete the row we just inserted
  | { op: "create"; key: UndoKey; id: number }
  // reverse an update/archive → restore the prior column values
  | { op: "update"; key: UndoKey; id: number; prev: Row }
  // reverse a hard delete → re-insert the captured row (same id)
  | { op: "delete"; key: UndoKey; row: Row }
  // reverse a key/value settings write (admin → links) → restore prior values
  | { op: "settings"; prev: Record<string, string | null>; paths: string[] };

/**
 * A signed, opaque undo token as it crosses to the client. The browser treats it
 * as a string and hands it straight back to `performUndo`, which verifies the
 * signature before parsing it back into an `UndoToken` (see undo-sign.ts). The
 * client never sees or can tamper with the snapshot inside.
 */
export type SignedUndoToken = string;

/**
 * What every undoable action returns — a superset of the old per-section
 * `FormState`. `message` is the toast headline; `undo` (when present, the signed
 * token) becomes the toast's Undo button.
 */
export type ActionResult =
  | {
      error?: string;
      ok?: boolean;
      message?: string;
      undo?: SignedUndoToken;
      // The id of a row a "create" action just inserted. Lets a create modal flip
      // to a second stage (images / sponsors / etc.) bound to the new entity.
      id?: number;
    }
  | undefined;
