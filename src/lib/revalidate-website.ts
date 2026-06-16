import "server-only";

/**
 * Tell the public website to drop its cached copy of a feed after a content
 * write, so the change shows up without waiting for the site's 24h fallback.
 *
 * Pass the feed tag(s) the write affects — `"events"`, `"projects"`, `"team"`,
 * `"sponsors"`, `"packages"` — or none to flush the whole site (`"website"`).
 * These map 1:1 to the tags `dsec-website/src/lib/api.ts` puts on each fetch.
 *
 * Fire-and-forget by design: a website that's down, deploying, or unconfigured
 * must never fail the dashboard action that triggered this. Errors are swallowed
 * (logged in dev). We still `await` it so the request actually leaves before a
 * serverless function freezes — but the 3s timeout caps the wait.
 *
 * No-ops unless DSEC_WEBSITE_URL + REVALIDATE_SECRET are set, so local dev
 * (usually no website running) and previews stay quiet.
 */
export async function revalidateWebsite(...tags: string[]): Promise<void> {
  const base = process.env.DSEC_WEBSITE_URL?.replace(/\/+$/, "");
  const secret = process.env.REVALIDATE_SECRET;
  if (!base || !secret) return;

  try {
    await fetch(`${base}/api/revalidate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-revalidate-secret": secret,
      },
      body: JSON.stringify({ tags: tags.length > 0 ? tags : ["website"] }),
      // Don't let a slow/hanging website stall the user's save.
      signal: AbortSignal.timeout(3000),
    });
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[revalidate-website] ping failed: ${(err as Error).message}`);
    }
  }
}
