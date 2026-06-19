/**
 * One-time admin step: register the Telegram bot webhook so the dashboard can
 * capture connect codes. Run AFTER the app is deployed (the webhook URL must be
 * a public https origin).
 *
 *   npx tsx scripts/set-telegram-webhook.ts
 *
 * Reads TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET (optional but recommended)
 * and APP_URL from the environment. Prints the bot @username — set that as
 * TELEGRAM_BOT_USERNAME so the settings page can build the t.me deep link.
 */
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not set");
  if (!appUrl) throw new Error("APP_URL not set (needs the public https origin)");
  if (!appUrl.startsWith("https://")) {
    throw new Error(`APP_URL must be https for a Telegram webhook (got ${appUrl})`);
  }
  // Telegram only accepts A-Z a-z 0-9 _ - (1-256 chars) for the secret token, so
  // a base64 secret (with + / =) is rejected. Catch it here with a clear fix.
  if (secret && !/^[A-Za-z0-9_-]{1,256}$/.test(secret)) {
    throw new Error(
      "TELEGRAM_WEBHOOK_SECRET may only contain A-Z a-z 0-9 _ - (1-256 chars). " +
        "Regenerate it (e.g. `openssl rand -hex 32`) and update .env.local + Vercel.",
    );
  }

  const webhookUrl = `${appUrl}/api/telegram/webhook`;
  console.log(`Registering Telegram webhook → ${webhookUrl}`);

  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: secret || undefined,
      allowed_updates: ["message"],
    }),
  });
  const json = await res.json();
  console.log("setWebhook →", json);

  const me = await fetch(`https://api.telegram.org/bot${token}/getMe`).then((r) => r.json());
  const username = me?.result?.username;
  if (username) {
    console.log(`\nBot is @${username}.`);
    console.log(`Set TELEGRAM_BOT_USERNAME=${username} so the deep link t.me/${username}?start=<code> works.`);
  } else {
    console.log("getMe →", me);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
