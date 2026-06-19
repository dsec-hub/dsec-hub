"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/dal";
import { bool, int, str } from "@/lib/form-data";
import { sendTestNotification } from "@/lib/notifications/dispatch";
import { getPrefsForUser, upsertPrefs } from "@/lib/notifications/prefs";
import type { NotificationChannel } from "@/lib/notifications/types";

export type NotifState = { ok?: boolean; error?: string } | undefined;

function clampInt(value: number | null, min: number, max: number, fallback: number): number {
  if (value == null || Number.isNaN(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

const DISCORD_WEBHOOK_RE =
  /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Save the full notification-preferences form (every channel + category). */
export async function updateNotificationPrefs(_prev: NotifState, fd: FormData): Promise<NotifState> {
  const user = await requireUser();

  const emailAddress = str(fd, "email_address");
  if (emailAddress && !EMAIL_RE.test(emailAddress)) {
    return { error: "Enter a valid email address (or leave it blank to use your account email)." };
  }

  const discordEnabled = bool(fd, "discord_enabled");
  const discordWebhookUrl = str(fd, "discord_webhook_url");
  if (discordWebhookUrl && !DISCORD_WEBHOOK_RE.test(discordWebhookUrl)) {
    return { error: "That doesn't look like a Discord webhook URL (it should start with https://discord.com/api/webhooks/…)." };
  }
  if (discordEnabled && !discordWebhookUrl) {
    return { error: "Paste a Discord webhook URL to turn the Discord channel on." };
  }

  await upsertPrefs(user.id, {
    emailEnabled: bool(fd, "email_enabled"),
    emailAddress,
    discordEnabled,
    discordWebhookUrl,
    telegramEnabled: bool(fd, "telegram_enabled"),
    notifyOnAssign: bool(fd, "notify_on_assign"),
    notifyDueDigest: bool(fd, "notify_due_digest"),
    notifyDueReminder: bool(fd, "notify_due_reminder"),
    dueSoonDays: clampInt(int(fd, "due_soon_days"), 1, 30, 3),
    reminderLeadDays: clampInt(int(fd, "reminder_lead_days"), 0, 30, 1),
  });

  revalidatePath("/settings/notifications");
  return { ok: true };
}

/**
 * Mint a one-time Telegram connect code and return the t.me deep link. The bot
 * webhook claims the code and stores the chat id when the user taps Start.
 */
export async function generateTelegramLink(): Promise<{ link?: string; error?: string }> {
  const user = await requireUser();
  const username = process.env.TELEGRAM_BOT_USERNAME;
  if (!process.env.TELEGRAM_BOT_TOKEN || !username) {
    return { error: "Telegram isn't set up on the server yet — ask an admin." };
  }
  const code = randomBytes(9).toString("base64url");
  await upsertPrefs(user.id, { telegramLinkCode: code });
  return { link: `https://t.me/${username}?start=${code}` };
}

/** Unlink Telegram for the signed-in user. */
export async function disconnectTelegram(): Promise<NotifState> {
  const user = await requireUser();
  await upsertPrefs(user.id, {
    telegramChatId: null,
    telegramEnabled: false,
    telegramLinkCode: null,
    telegramLinkedAt: null,
  });
  revalidatePath("/settings/notifications");
  return { ok: true };
}

/** Send a one-off test message to a single channel using the SAVED prefs. */
export async function sendTestNotificationAction(channel: NotificationChannel): Promise<NotifState> {
  const user = await requireUser();
  const prefs = await getPrefsForUser(user.id);
  try {
    await sendTestNotification(channel, prefs, user.email);
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Test failed to send." };
  }
}
