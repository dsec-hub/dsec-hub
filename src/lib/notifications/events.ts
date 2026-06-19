import "server-only";

import { and, eq, isNotNull, isNull } from "drizzle-orm";

import { db } from "@/db";
import { appUser } from "@/db/schema";
import { tasks } from "@/db/workspace-schema";

import { dispatchNotification } from "./dispatch";
import { getUserNotifyContext, userIdForPerson } from "./prefs";
import { dueDigestContent, dueReminderContent, taskAssignedContent, type DigestItem } from "./templates";

// --- date helpers (date-only, local; cron runs in UTC on Vercel) ----------

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

/**
 * Instant on-assignment notice. Maps the assignee person → an active login user
 * and skips when there's no login or the assignee IS the actor (self-assignment
 * shouldn't ping you). Called from the task server actions via `after()`, so it
 * never blocks or breaks the mutation.
 */
export async function notifyTaskAssigned(args: {
  taskId: number;
  assigneePersonId: number;
  actorUserId: number;
}): Promise<void> {
  const userId = await userIdForPerson(args.assigneePersonId);
  if (!userId || userId === args.actorUserId) return;

  const ctx = await getUserNotifyContext(userId);
  if (!ctx) return;

  const [t] = await db
    .select({ title: tasks.title, dueDate: tasks.dueDate })
    .from(tasks)
    .where(eq(tasks.id, args.taskId))
    .limit(1);
  if (!t) return;

  let actorName: string | null = null;
  const [actor] = await db
    .select({ name: appUser.name })
    .from(appUser)
    .where(eq(appUser.id, args.actorUserId))
    .limit(1);
  actorName = actor?.name ?? null;

  await dispatchNotification({
    userId,
    kind: "task_assigned",
    content: taskAssignedContent({
      taskId: args.taskId,
      taskTitle: t.title,
      dueDate: t.dueDate,
      assignedByName: actorName,
    }),
    // Timestamped so every (re)assignment is its own event, never deduped away.
    dedupeBase: `assign:t${args.taskId}:to${userId}:${Date.now()}`,
    taskId: args.taskId,
    prefs: ctx.prefs,
    accountEmail: ctx.email,
  });
}

/**
 * The once-a-day cron body (Vercel Hobby = one run/day, so digest + reminders
 * share this pass). For every active assignee:
 *   • Digest  — one message listing open tasks due within their `dueSoonDays`
 *               horizon (overdue included), if any. Deduped per user per day.
 *   • Reminder — one message per open task whose due date is exactly
 *               `reminderLeadDays` away. Deduped per task+due-date.
 * Returns counts for the cron response/logs.
 */
export async function runDailyNotifications(): Promise<{ digests: number; reminders: number }> {
  const todayISO = isoDate(new Date());

  // All open, non-archived, dated, assigned tasks — the candidate pool.
  const rows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      dueDate: tasks.dueDate,
      assigneeId: tasks.assigneeId,
    })
    .from(tasks)
    .where(
      and(
        eq(tasks.archived, false),
        isNull(tasks.completedAt),
        isNotNull(tasks.dueDate),
        isNotNull(tasks.assigneeId),
      ),
    );
  if (rows.length === 0) return { digests: 0, reminders: 0 };

  // person → active login user id
  const users = await db
    .select({ id: appUser.id, personId: appUser.personId })
    .from(appUser)
    .where(and(isNotNull(appUser.personId), eq(appUser.isActive, true)));
  const personToUser = new Map<number, number>();
  for (const u of users) if (u.personId != null) personToUser.set(u.personId, u.id);

  // group candidate tasks by login user
  const byUser = new Map<number, { id: number; title: string; dueDate: string }[]>();
  for (const r of rows) {
    if (r.assigneeId == null || r.dueDate == null) continue;
    const uid = personToUser.get(r.assigneeId);
    if (!uid) continue;
    let list = byUser.get(uid);
    if (!list) {
      list = [];
      byUser.set(uid, list);
    }
    list.push({ id: r.id, title: r.title, dueDate: r.dueDate });
  }

  let digests = 0;
  let reminders = 0;

  for (const [uid, taskList] of byUser) {
    const ctx = await getUserNotifyContext(uid);
    if (!ctx) continue;
    const { prefs, email } = ctx;

    // Daily digest — everything due within the horizon (overdue included).
    if (prefs.notifyDueDigest) {
      const horizon = addDaysISO(todayISO, prefs.dueSoonDays);
      const items: DigestItem[] = taskList
        .filter((t) => t.dueDate <= horizon)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        .map((t) => ({ id: t.id, title: t.title, dueDate: t.dueDate, overdue: t.dueDate < todayISO }));
      if (items.length > 0) {
        await dispatchNotification({
          userId: uid,
          kind: "due_digest",
          content: dueDigestContent({ items }),
          dedupeBase: `digest:u${uid}:${todayISO}`,
          taskId: null,
          prefs,
          accountEmail: email,
        });
        digests++;
      }
    }

    // Per-task reminder — tasks due exactly `reminderLeadDays` from today.
    if (prefs.notifyDueReminder) {
      const target = addDaysISO(todayISO, prefs.reminderLeadDays);
      for (const t of taskList.filter((t) => t.dueDate === target)) {
        await dispatchNotification({
          userId: uid,
          kind: "due_reminder",
          content: dueReminderContent({ taskId: t.id, taskTitle: t.title, dueDate: t.dueDate }),
          dedupeBase: `reminder:u${uid}:t${t.id}:due${t.dueDate}`,
          taskId: t.id,
          prefs,
          accountEmail: email,
        });
        reminders++;
      }
    }
  }

  return { digests, reminders };
}
