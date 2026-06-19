import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { notificationLog } from "@/db/schema";

import { sendDiscordNotification } from "./channels/discord";
import { sendEmailNotification } from "./channels/email";
import { sendTelegramNotification } from "./channels/telegram";
import { testContent } from "./templates";
import type {
  NotificationChannel,
  NotificationContent,
  NotificationKind,
  NotificationPrefs,
} from "./types";

function categoryEnabled(prefs: NotificationPrefs, kind: NotificationKind): boolean {
  if (kind === "task_assigned") return prefs.notifyOnAssign;
  if (kind === "due_digest") return prefs.notifyDueDigest;
  return prefs.notifyDueReminder;
}

/** The channels that are both enabled AND configured for this user. */
function activeChannels(
  prefs: NotificationPrefs,
  accountEmail: string,
): { channel: NotificationChannel; run: (c: NotificationContent) => Promise<void> }[] {
  const out: { channel: NotificationChannel; run: (c: NotificationContent) => Promise<void> }[] = [];
  if (prefs.emailEnabled) {
    const to = prefs.emailAddress ?? accountEmail;
    if (to) out.push({ channel: "email", run: (c) => sendEmailNotification(to, c) });
  }
  if (prefs.discordEnabled && prefs.discordWebhookUrl) {
    const url = prefs.discordWebhookUrl;
    out.push({ channel: "discord", run: (c) => sendDiscordNotification(url, c) });
  }
  if (prefs.telegramEnabled && prefs.telegramChatId) {
    const chatId = prefs.telegramChatId;
    out.push({ channel: "telegram", run: (c) => sendTelegramNotification(chatId, c) });
  }
  return out;
}

/**
 * Fan a built notification out to every enabled channel, once. The UNIQUE
 * `dedupe_key` (base + channel) makes this idempotent: a re-run (the daily cron
 * firing twice, a retried action) claims the key with `onConflictDoNothing` and
 * skips anything already attempted. One channel failing never aborts the others
 * (Promise.allSettled + per-channel try/catch in deliverOnce).
 */
export async function dispatchNotification(args: {
  userId: number;
  kind: NotificationKind;
  content: NotificationContent;
  dedupeBase: string;
  taskId: number | null;
  prefs: NotificationPrefs;
  accountEmail: string;
}): Promise<void> {
  const { userId, kind, content, dedupeBase, taskId, prefs, accountEmail } = args;
  if (!categoryEnabled(prefs, kind)) return;

  const channels = activeChannels(prefs, accountEmail);
  await Promise.allSettled(
    channels.map((ch) =>
      deliverOnce({
        userId,
        kind,
        taskId,
        channel: ch.channel,
        dedupeKey: `${dedupeBase}:${ch.channel}`,
        run: () => ch.run(content),
      }),
    ),
  );
}

async function deliverOnce(args: {
  userId: number;
  kind: NotificationKind;
  taskId: number | null;
  channel: NotificationChannel;
  dedupeKey: string;
  run: () => Promise<void>;
}): Promise<void> {
  const { userId, kind, taskId, channel, dedupeKey, run } = args;
  // Claim the key atomically. If it already exists, a prior run handled it.
  const claimed = await db
    .insert(notificationLog)
    .values({ userId, channel, kind, taskId, dedupeKey, status: "sending" })
    .onConflictDoNothing({ target: notificationLog.dedupeKey })
    .returning({ id: notificationLog.id });
  if (claimed.length === 0) return;
  const id = claimed[0].id;
  try {
    await run();
    await db.update(notificationLog).set({ status: "sent" }).where(eq(notificationLog.id, id));
  } catch (err) {
    await db
      .update(notificationLog)
      .set({ status: "failed", detail: String(err).slice(0, 500) })
      .where(eq(notificationLog.id, id));
    // swallowed — surfaced via the failed log row, never bubbles to the caller
  }
}

/**
 * Send a one-off TEST message to a single channel from the settings page.
 * Bypasses the dedupe log (a test should always go out) and throws on
 * misconfiguration so the settings action can surface a clear error.
 */
export async function sendTestNotification(
  channel: NotificationChannel,
  prefs: NotificationPrefs,
  accountEmail: string,
): Promise<void> {
  const content = testContent();
  if (channel === "email") {
    const to = prefs.emailAddress ?? accountEmail;
    if (!to) throw new Error("No email address on file.");
    await sendEmailNotification(to, content);
  } else if (channel === "discord") {
    if (!prefs.discordWebhookUrl) throw new Error("No Discord webhook URL saved.");
    await sendDiscordNotification(prefs.discordWebhookUrl, content);
  } else {
    if (!prefs.telegramChatId) throw new Error("Telegram isn't connected yet.");
    await sendTelegramNotification(prefs.telegramChatId, content);
  }
}
