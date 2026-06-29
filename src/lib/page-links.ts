import "server-only";

import { apiEnv } from "@/lib/api-env";

/**
 * Links from the committee dashboard out to a custom page on the public site
 * (dsec-website), mirroring lib/event-links.ts:
 *
 *  - PUBLISHED pages get the clean live URL `dsec.club/<slug>` (the website
 *    serves the page from its `/[slug]` route off the same slug stored here).
 *  - DRAFT pages get a temporary, unguessable *preview* URL minted by dsec-api
 *    (`GET /documents/{id}/page-preview-link`) — the website renders it via the
 *    token-gated preview feed, so the committee sees exactly how the page will
 *    look before flipping it public.
 *
 * Both helpers return `null` when the relevant env isn't configured (no website
 * origin, or no API URL/key) so the editor simply hides the button rather than
 * rendering a dead link.
 */

/** The public site's origin (e.g. https://dsec.club), trailing slash trimmed. */
function websiteBase(): string | null {
  const b = process.env.DSEC_WEBSITE_URL;
  return b ? b.replace(/\/+$/, "") : null;
}

/** Live URL for a published page, or `null` if the website origin / slug is unset. */
export function pageSiteUrl(slug: string | null | undefined): string | null {
  const base = websiteBase();
  const s = slug?.trim();
  return base && s ? `${base}/${s}` : null;
}

/**
 * Mint a temporary preview URL for a (draft) page via dsec-api, or `null` if the
 * website origin / API isn't configured or the API call fails. Best-effort: the
 * editor hides the button rather than surfacing an error.
 */
export async function pagePreviewUrl(docId: number): Promise<string | null> {
  const site = websiteBase();
  const env = apiEnv();
  if (!site || !env) return null;
  try {
    const res = await fetch(`${env.base}/documents/${docId}/page-preview-link`, {
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
