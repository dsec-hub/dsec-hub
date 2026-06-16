"use server";

import { requireWrite } from "@/lib/dal";
import { REGISTRY, applyUndo } from "@/lib/undo";
import { verifyToken } from "@/lib/undo-sign";
import type { ActionResult, SignedUndoToken } from "@/lib/undo-types";

/**
 * Reverse a single mutation from the signed token its action returned. The token
 * comes from the client, so it is NEVER trusted: its HMAC signature is verified
 * first (rejecting any forged/tampered snapshot — see undo-sign.ts), then the
 * caller's write access to the affected module is re-checked (settings tokens
 * require admin) before anything is applied. Undo only ever replays the exact
 * server-produced snapshot, granting no new power.
 */
export async function performUndo(signed: SignedUndoToken | undefined): Promise<ActionResult> {
  const token = verifyToken(signed);
  if (!token) return { error: "Nothing to undo." };

  const moduleKey = token.op === "settings" ? "admin" : REGISTRY[token.key]?.module;
  if (!moduleKey) return { error: "Can't undo that." };
  await requireWrite(moduleKey); // redirects view-only users (settings tokens → admin only)

  try {
    await applyUndo(token);
    return { ok: true };
  } catch {
    return { error: "Couldn't undo — the data may have changed since." };
  }
}
