import { eq } from "drizzle-orm";

import { db } from "@/db";
import { notificationPref } from "@/db/schema";
import { sendBotMessage } from "@/lib/notifications/channels/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Minimal shape of the Telegram update we care about (`/start <code>`). */
type TgUpdate = { message?: { text?: string; chat?: { id?: number } } };

async function reply(chatId: string, text: string): Promise<void> {
  try {
    await sendBotMessage(chatId, text);
  } catch (err) {
    console.warn("[telegram:webhook] reply failed:", err);
  }
}

/**
 * Telegram bot webhook. Registered via `scripts/set-telegram-webhook.ts`.
 * Verifies the `x-telegram-bot-api-secret-token` header, then on `/start <code>`
 * claims the matching connect code and stores the chat id on the user's prefs
 * (auto-enabling the Telegram channel). Always returns 200 quickly so Telegram
 * doesn't retry.
 */
export async function POST(request: Request): Promise<Response> {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && request.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }

  let update: TgUpdate;
  try {
    update = (await request.json()) as TgUpdate;
  } catch {
    return new Response("ok");
  }

  const text = update.message?.text?.trim();
  const chatId = update.message?.chat?.id;
  if (!text || chatId == null) return new Response("ok");

  const match = /^\/start(?:\s+(\S+))?/.exec(text);
  if (!match) return new Response("ok");

  const code = match[1];
  if (!code) {
    await reply(
      String(chatId),
      "Open the DSEC dashboard → <b>Settings → Notifications</b> and tap “Connect Telegram” to link your account.",
    );
    return new Response("ok");
  }

  const [pref] = await db
    .select({ userId: notificationPref.userId })
    .from(notificationPref)
    .where(eq(notificationPref.telegramLinkCode, code))
    .limit(1);
  if (!pref) {
    await reply(
      String(chatId),
      "That link has expired or was already used. Generate a fresh one from <b>Settings → Notifications</b>.",
    );
    return new Response("ok");
  }

  const now = new Date().toISOString();
  await db
    .update(notificationPref)
    .set({
      telegramChatId: String(chatId),
      telegramEnabled: true,
      telegramLinkedAt: now,
      telegramLinkCode: null,
      updatedAt: now,
    })
    .where(eq(notificationPref.userId, pref.userId));

  await reply(String(chatId), "✅ Connected! You'll now receive DSEC task notifications here.");
  return new Response("ok");
}
