/**
 * Shared types + defaults for the notification system. Pure (no `server-only`)
 * so the settings client form can import the types and DEFAULT_PREFS.
 */

export type NotificationChannel = "email" | "discord" | "telegram";

/** task_assigned = instant on-assign · due_digest = daily roll-up · due_reminder = N days before a due date */
export type NotificationKind = "task_assigned" | "due_digest" | "due_reminder";

/** The effective per-user preferences (a row in notification_pref, or DEFAULT_PREFS when none). */
export type NotificationPrefs = {
  emailEnabled: boolean;
  /** null ⇒ deliver to the account email (app_user.email). */
  emailAddress: string | null;
  discordEnabled: boolean;
  discordWebhookUrl: string | null;
  telegramEnabled: boolean;
  telegramChatId: string | null;
  telegramLinkCode: string | null;
  telegramLinkedAt: string | null;
  notifyOnAssign: boolean;
  notifyDueDigest: boolean;
  notifyDueReminder: boolean;
  dueSoonDays: number;
  reminderLeadDays: number;
};

export const DEFAULT_PREFS: NotificationPrefs = {
  emailEnabled: true,
  emailAddress: null,
  discordEnabled: false,
  discordWebhookUrl: null,
  telegramEnabled: false,
  telegramChatId: null,
  telegramLinkCode: null,
  telegramLinkedAt: null,
  notifyOnAssign: true,
  notifyDueDigest: true,
  notifyDueReminder: true,
  dueSoonDays: 3,
  reminderLeadDays: 1,
};

/**
 * A channel-agnostic, already-built message. Each channel renderer turns this
 * into its own format (branded email / Discord embed / Telegram HTML). `lines`
 * are PLAIN text — every renderer escapes them for its own target.
 */
export type NotificationContent = {
  eyebrow: string;
  heading: string;
  lines: string[];
  ctaLabel: string;
  ctaUrl: string;
};
