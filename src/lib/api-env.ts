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

/**
 * The dsec-api base URL on its own, for callers that only need to *name* the API
 * rather than call it (e.g. rendering the MCP connect URL for a user to copy).
 *
 * Separate from `apiEnv()`, which returns null unless a KEY is also present —
 * that forced display-only callers onto a hardcoded production fallback, so a
 * deploy with DSEC_API_URL set but no key showed the wrong host. Still falls back
 * to production when nothing is configured, since a URL must be rendered.
 */
export function apiBaseUrl(): string {
  return (process.env.DSEC_API_URL || "https://api.dsec.club").replace(/\/+$/, "");
}
