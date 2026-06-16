import "server-only";

/**
 * Read the dsec-api base URL + bearer key from the environment.
 *
 * Returns null when either is unset so callers degrade gracefully (image/file
 * uploads, AI meeting notes, and review stats all surface a "needs DSEC_API_URL
 * + DSEC_API_KEY" message rather than crashing). Server-only: the key must never
 * reach the browser. Shared by every server action that talks to dsec-api.
 */
export function apiEnv(): { base: string; key: string } | null {
  const base = process.env.DSEC_API_URL;
  const key = process.env.DSEC_API_KEY;
  if (!base || !key) return null;
  return { base: base.replace(/\/+$/, ""), key };
}
