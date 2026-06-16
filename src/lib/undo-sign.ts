import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import type { UndoToken } from "@/lib/undo-types";

/**
 * Undo tokens round-trip through the browser (an action returns one, the toast's
 * "Undo" button hands it back). The snapshot inside carries raw prior column
 * values, so an unsigned token lets a caller forge `prev`/`row` to set fields the
 * forward action deliberately guards — e.g. an admin reversing past the
 * last-active-admin / self-deactivation lockout, or un-setting a system role's
 * `isSystem`. Signing makes the token tamper-evident: `performUndo` rejects any
 * token whose payload doesn't match its signature, so undo can only replay the
 * exact snapshot the server produced.
 *
 * Keyed by the NextAuth secret (always set in production); a stable dev fallback
 * keeps local undo working without extra config.
 */
const KEY =
  process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "dsec-dev-undo-signing-key";

function mac(payload: string): string {
  return createHmac("sha256", KEY).update(payload).digest("base64url");
}

/** Serialize + sign a token into an opaque `<payload>.<sig>` string. */
export function signToken(token: UndoToken): string {
  const payload = Buffer.from(JSON.stringify(token), "utf8").toString("base64url");
  return `${payload}.${mac(payload)}`;
}

/** Verify + parse a signed token. Returns null if missing, tampered, or malformed. */
export function verifyToken(signed: string | undefined | null): UndoToken | null {
  if (!signed || typeof signed !== "string") return null;
  const dot = signed.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = signed.slice(0, dot);
  const sig = signed.slice(dot + 1);

  const got = Buffer.from(sig);
  const want = Buffer.from(mac(payload));
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as UndoToken;
  } catch {
    return null;
  }
}
