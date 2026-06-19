import { timingSafeEqual } from "node:crypto";

import { runDailyNotifications } from "@/lib/notifications/events";

// node-postgres (`pg`) needs Node's net/tls — never the edge runtime. The daily
// batch may send several messages, so allow up to 60s (Hobby cap).
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** Constant-time bearer-token check (avoids leaking the secret via timing). */
function bearerOk(header: string | null, secret: string): boolean {
  if (!header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Daily notification sweep — triggered by Vercel Cron (see vercel.json,
 * `0 8 * * *`). Vercel sends `Authorization: Bearer ${CRON_SECRET}`. Runs the
 * digest + per-task reminders in one pass (Hobby plan = one run/day). Has no
 * session, so it queries the DB directly via the notification helpers.
 */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return new Response("CRON_SECRET not configured", { status: 500 });
  }
  if (!bearerOk(request.headers.get("authorization"), secret)) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const result = await runDailyNotifications();
    return Response.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron:notifications] failed:", err);
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
