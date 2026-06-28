import "server-only";

import { apiEnv } from "@/lib/api-env";

/**
 * Links from the committee dashboard out to an event's page on the public site
 * (dsec-website):
 *
 *  - PUBLISHED events get the live URL, built from the same slug dsec-api's feed
 *    computes (`_event_slug`), so the link resolves with no round-trip.
 *  - DRAFT events get a temporary, unguessable *preview* URL minted by dsec-api
 *    (`GET /events-api/{id}/preview-link`) — the website renders it via the
 *    token-gated preview feed, so the committee can see exactly how the event
 *    will look before flipping it public.
 *
 * All helpers return `null` when the relevant env isn't configured (no website
 * origin, or no API URL/key) so the dashboard simply hides the button rather
 * than rendering a dead link.
 */

/** The public site's origin (e.g. https://dsec.club), trailing slash trimmed. */
function websiteBase(): string | null {
  const b = process.env.DSEC_WEBSITE_URL;
  return b ? b.replace(/\/+$/, "") : null;
}

/** Mirror of dsec-api `_slugify`: lower-case, non-alphanumerics → "-", trimmed. */
function slugify(text: string): string {
  return (
    (text || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "event"
  );
}

/**
 * Mirror of dsec-api `_event_slug`: the name slug plus the ISO start date (when
 * set). MUST stay in sync with the API so a published link resolves.
 */
export function eventPublicSlug(name: string, startDate: string | null | undefined): string {
  const base = slugify(name);
  return startDate ? `${base}-${startDate}` : base;
}

/** Live URL for a published event, or `null` if the website origin is unset. */
export function eventPublicUrl(name: string, startDate: string | null | undefined): string | null {
  const base = websiteBase();
  return base ? `${base}/events/${eventPublicSlug(name, startDate)}` : null;
}

/**
 * Mint a temporary preview URL for a (draft) event via dsec-api, or `null` if
 * the website origin / API isn't configured or the API call fails. Best-effort:
 * the dashboard hides the button rather than surfacing an error.
 */
export async function eventPreviewUrl(eventId: number): Promise<string | null> {
  const site = websiteBase();
  const env = apiEnv();
  if (!site || !env) return null;
  try {
    const res = await fetch(`${env.base}/events-api/${eventId}/preview-link`, {
      headers: { authorization: `Bearer ${env.key}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { path?: string };
    return data.path ? `${site}${data.path}` : null;
  } catch {
    return null;
  }
}

/**
 * The single "open on the public site" URL + label for an event, branching on
 * publish state: the live page when published, a freshly-minted preview link
 * when still a draft. Returns `{ url: null }` when no link can be built.
 */
export async function eventSiteLink(event: {
  id: number;
  name: string;
  startDate: string | null | undefined;
  isPublic: boolean;
}): Promise<{ url: string | null; label: string; preview: boolean }> {
  if (event.isPublic) {
    return { url: eventPublicUrl(event.name, event.startDate), label: "View event", preview: false };
  }
  return { url: await eventPreviewUrl(event.id), label: "Preview", preview: true };
}
