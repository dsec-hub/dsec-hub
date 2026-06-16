import "server-only";

import { createHash, randomBytes } from "crypto";

/** Generate a raw invite token (goes in the link, never stored) plus its
 * sha-256 hash (stored, looked up on acceptance). */
export function createInviteToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("hex");
  return { raw, hash: hashToken(raw) };
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
