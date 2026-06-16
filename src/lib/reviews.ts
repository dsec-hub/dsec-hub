// Server-side helpers for the per-event Tally review form. The dsec-api owns the
// Tally key; the dashboard talks to it over HTTP with a bearer key (same shape as
// media/sponsor uploads). Importing this from a Client Component would leak the
// key, so it must only be used in Server Components / Server Actions.
import "server-only";

import { apiEnv } from "@/lib/api-env";

export type ReviewSummary = {
  responseCount: number;
  averageRating: number | null;
};

/**
 * Best-effort live stats for an event's review form. Returns null when the API
 * isn't configured or is unreachable — the stored form link still works, so the
 * panel just renders without counts in that case (never blocks the page).
 */
export async function fetchReviewSummary(eventId: number): Promise<ReviewSummary | null> {
  const env = apiEnv();
  if (!env) return null;
  try {
    const res = await fetch(`${env.base}/events-api/${eventId}/review-form/responses`, {
      headers: { Authorization: `Bearer ${env.key}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      responseCount: typeof data.response_count === "number" ? data.response_count : 0,
      averageRating: typeof data.average_rating === "number" ? data.average_rating : null,
    };
  } catch {
    return null;
  }
}
