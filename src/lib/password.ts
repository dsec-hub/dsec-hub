import "server-only";

import bcrypt from "bcryptjs";

/**
 * Single source of truth for the dashboard's password policy, shared by invite
 * acceptance, the profile change-password form, and admin password resets so the
 * three stay consistent.
 *
 * This is an exec dashboard holding member PII and finance data, so the minimum
 * length is 12 (up from the old 8) and the bcrypt work factor is 12 (up from 10).
 */
export const MIN_PASSWORD_LENGTH = 12;

// bcrypt cost factor. 12 is a sensible interactive-login default; bcrypt only
// hashes the first 72 bytes, so very long inputs are effectively capped there.
const BCRYPT_COST = 12;

/** Validate a candidate password. Returns an error message, or null if OK. */
export function validatePassword(pw: string): string | null {
  if (pw.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

/** Hash a password with the standard work factor. */
export function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, BCRYPT_COST);
}
