import "server-only";

import { db } from "@/db";
import { usageEvents } from "@/db/workspace-schema";

type LogInput = {
  actorId?: number | null;
  actorLabel?: string | null;
  source?: "dashboard" | "api";
  action: "login" | "access" | "view" | "create" | "update" | "archive" | "delete";
  targetType?: string | null;
  targetId?: string | number | null;
  path?: string | null;
  detail?: string | null;
};

/**
 * Best-effort usage/audit log. Never throws — a logging failure must never
 * break a page render or a mutation. Powers the admin usage-stats view.
 */
export async function logUsage(input: LogInput): Promise<void> {
  try {
    await db.insert(usageEvents).values({
      actorType: "user",
      actorId: input.actorId ?? null,
      actorLabel: input.actorLabel ?? null,
      source: input.source ?? "dashboard",
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId == null ? null : String(input.targetId),
      path: input.path ?? null,
      detail: input.detail ?? null,
    });
  } catch {
    // swallow — logging is non-critical
  }
}

/** Log that a member accessed the dashboard (a per-navigation heartbeat). */
export async function logAccess(
  user: { id: number; email: string },
  path?: string | null,
): Promise<void> {
  await logUsage({
    actorId: user.id,
    actorLabel: user.email,
    action: "access",
    path: path ?? null,
  });
}

/** Log a content mutation (create/update/archive/delete) by a member. */
export async function logMutation(
  user: { id: number; email: string },
  action: "create" | "update" | "archive" | "delete",
  targetType: string,
  targetId?: string | number | null,
  detail?: string,
): Promise<void> {
  await logUsage({
    actorId: user.id,
    actorLabel: user.email,
    action,
    targetType,
    targetId,
    detail,
  });
}
