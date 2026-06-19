import { timingSafeEqual } from "node:crypto";

import { notifyTaskAssigned } from "@/lib/notifications/events";

// Reaches Postgres + Resend/Telegram/Discord — Node runtime only, never edge.
export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

/** Constant-time bearer check against the shared api↔hub secret. */
function bearerOk(header: string | null, secret: string): boolean {
  if (!header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Internal hand-off from dsec-api: a task was (re)assigned via the REST API or
 * the MCP server, which never touch hub's server actions — so the dashboard's
 * on-assign `after()` hook can't fire for it. dsec-api POSTs here so the
 * assignee still gets notified, through the SAME notifier, channel prefs and
 * dedupe the dashboard uses.
 *
 * Auth is a shared secret in `Authorization: Bearer ${HUB_NOTIFY_SECRET}` (must
 * match dsec-api's HUB_NOTIFY_SECRET). This is server-to-server, not a user
 * session. Body: { taskId, assigneePersonId, actorUserId }. `actorUserId` is
 * null when dsec-api can't resolve the actor (API-key / MCP callers) → notify
 * always; a number lets notifyTaskAssigned skip self-assignment.
 */
export async function POST(request: Request): Promise<Response> {
  const secret = process.env.HUB_NOTIFY_SECRET;
  if (!secret) {
    return new Response("HUB_NOTIFY_SECRET not configured", { status: 500 });
  }
  if (!bearerOk(request.headers.get("authorization"), secret)) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
  }

  const { taskId, assigneePersonId, actorUserId } = (body ?? {}) as {
    taskId?: unknown;
    assigneePersonId?: unknown;
    actorUserId?: unknown;
  };
  if (typeof taskId !== "number" || typeof assigneePersonId !== "number") {
    return Response.json(
      { ok: false, error: "taskId and assigneePersonId must be numbers" },
      { status: 400 },
    );
  }
  const actor = typeof actorUserId === "number" ? actorUserId : null;

  try {
    await notifyTaskAssigned({ taskId, assigneePersonId, actorUserId: actor });
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[internal:notify-assignment] failed:", err);
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
