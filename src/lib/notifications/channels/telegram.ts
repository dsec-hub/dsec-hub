import "server-only";

import type { NotificationContent } from "../types";

/** Escape user/DB text for Telegram HTML parse mode. */
export function escapeTelegramHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Low-level send — used by both notifications and the connect-webhook reply. */
export async function sendBotMessage(chatId: string, html: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not set");
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: html,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Telegram sendMessage ${res.status}: ${detail}`);
  }
}

export async function sendTelegramNotification(
  chatId: string,
  c: NotificationContent,
): Promise<void> {
  const body = [
    `<b>${escapeTelegramHtml(c.heading)}</b>`,
    "",
    ...c.lines.map(escapeTelegramHtml),
    "",
    `<a href="${escapeTelegramHtml(c.ctaUrl)}">${escapeTelegramHtml(c.ctaLabel)}</a>`,
  ].join("\n");
  await sendBotMessage(chatId, body);
}
