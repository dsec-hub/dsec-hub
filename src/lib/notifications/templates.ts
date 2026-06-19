import "server-only";

import type { NotificationContent } from "./types";

/**
 * Public origin for links inside notifications. Unlike `getAppUrl()` in
 * `lib/email.ts`, this never reads request headers — notifications are built
 * inside `after()` / the cron route where there is no meaningful request host —
 * so APP_URL must be set in production (falls back to localhost in dev).
 */
export function appBaseUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function taskUrl(taskId: number): string {
  return `${appBaseUrl()}/tasks/${taskId}/edit`;
}

/** "2026-06-22" → "22 Jun". Returns "no due date" for null. */
function fmtDue(iso: string | null): string {
  if (!iso) return "no due date";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

export function taskAssignedContent(args: {
  taskId: number;
  taskTitle: string;
  dueDate: string | null;
  assignedByName: string | null;
}): NotificationContent {
  return {
    eyebrow: "New task",
    heading: `You've been assigned: ${args.taskTitle}`,
    lines: [
      args.assignedByName
        ? `${args.assignedByName} assigned this task to you.`
        : "This task was assigned to you.",
      args.dueDate ? `Due ${fmtDue(args.dueDate)}.` : "No due date set.",
    ],
    ctaLabel: "Open task",
    ctaUrl: taskUrl(args.taskId),
  };
}

export function dueReminderContent(args: {
  taskId: number;
  taskTitle: string;
  dueDate: string;
}): NotificationContent {
  return {
    eyebrow: "Reminder",
    heading: `Due soon: ${args.taskTitle}`,
    lines: [`This task is due ${fmtDue(args.dueDate)}.`],
    ctaLabel: "Open task",
    ctaUrl: taskUrl(args.taskId),
  };
}

export type DigestItem = { id: number; title: string; dueDate: string; overdue: boolean };

export function dueDigestContent(args: { items: DigestItem[] }): NotificationContent {
  const { items } = args;
  const overdueCount = items.filter((i) => i.overdue).length;
  const summary =
    overdueCount > 0
      ? `${items.length} task${items.length === 1 ? "" : "s"} need attention — ${overdueCount} overdue.`
      : `${items.length} task${items.length === 1 ? "" : "s"} due soon.`;
  return {
    eyebrow: "Daily digest",
    heading: summary,
    lines: items.map(
      (i) =>
        `• ${i.title} — ${i.overdue ? `OVERDUE (was due ${fmtDue(i.dueDate)})` : `due ${fmtDue(i.dueDate)}`}`,
    ),
    ctaLabel: "Open dashboard",
    ctaUrl: `${appBaseUrl()}/dashboard`,
  };
}

export function testContent(): NotificationContent {
  return {
    eyebrow: "Test",
    heading: "DSEC notifications are working",
    lines: [
      "This is a test from your DSEC dashboard notification settings.",
      "If you can read this, the channel is connected correctly.",
    ],
    ctaLabel: "Open dashboard",
    ctaUrl: `${appBaseUrl()}/dashboard`,
  };
}
