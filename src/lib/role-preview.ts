import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Admin "view as role" preview. An HMAC-signed cookie names the role an admin is
 * currently previewing. The DAL (getCurrentUser) overlays that role by
 * INTERSECTING module sets — pure narrowing, never escalation — and disables
 * writes. Signing prevents a tampered roleId from selecting an arbitrary role.
 */
export const PREVIEW_COOKIE = "dsec_preview_role";
const TTL_MS = 60 * 60 * 1000; // 1 hour

function secret(): string {
  return process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "dev-insecure-preview-secret";
}

function mac(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

/** Build the signed cookie value `roleId.timestamp.hmac`. */
export function signPreview(roleId: number): string {
  const payload = `${roleId}.${Date.now()}`;
  return `${payload}.${mac(payload)}`;
}

/** Verify a cookie value; returns the roleId if the signature is valid and the
 * token hasn't expired, else null. */
export function verifyPreview(value: string | undefined | null): number | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [roleIdStr, tsStr, sig] = parts;
  const expected = mac(`${roleIdStr}.${tsStr}`);
  if (sig.length !== expected.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  const ts = Number(tsStr);
  const now = Date.now();
  if (!Number.isFinite(ts) || now - ts > TTL_MS || ts - now > 60_000) return null;
  const roleId = Number(roleIdStr);
  return Number.isFinite(roleId) ? roleId : null;
}
