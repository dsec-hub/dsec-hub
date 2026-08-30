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
 * must never fail the dashboard action that triggered this. Failures are logged
 * (never thrown) — including HTTP failures such as a 401 from a mismatched
 * REVALIDATE_SECRET, which `fetch` reports as a successful request.
 *
 * We still `await` it so the request actually leaves before a serverless
 * function freezes — but the 3s timeout caps the wait.
 *
 * No-ops unless DSEC_WEBSITE_URL + REVALIDATE_SECRET are set, so local dev
 * (usually no website running) and previews stay quiet.
 */
export async function revalidateWebsite(...tags: string[]): Promise<void> {
  const base = process.env.DSEC_WEBSITE_URL?.replace(/\/+$/, "");
  const secret = process.env.REVALIDATE_SECRET;
  if (!base || !secret) return;

  const sent = tags.length > 0 ? tags : ["website"];

  try {
    const res = await fetch(`${base}/api/revalidate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-revalidate-secret": secret,
      },
      body: JSON.stringify({ tags: sent }),
      // Don't let a slow/hanging website stall the user's save.
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      // Unconditional: a 401 (secret mismatch) or 404 (wrong DSEC_WEBSITE_URL)
      // means every committee edit stops reaching dsec.club promptly, and the
      // save still reports success. Silence here is how that goes unnoticed
      // for weeks. Never throw — a dead website must not fail a save.
      console.error(
        `[revalidate-website] ${base}/api/revalidate returned ${res.status} for tags [${sent.join(", ")}]`,
      );
    }
  } catch (err) {
    console.error(
      `[revalidate-website] ping to ${base} failed for tags [${sent.join(", ")}]: ${(err as Error).message}`,
    );
  }
}
