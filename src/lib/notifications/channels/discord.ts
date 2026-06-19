import "server-only";

import type { NotificationContent } from "../types";

const ACTION_PINK = 0xe91e63; // DSEC accent — see [[dsec-accent-pink]]

/**
 * POST a single embed to a user's own Discord channel webhook. No bot/token —
 * each member pastes their webhook URL in settings. Discord renders markdown
 * links in the embed description, so the CTA is appended as `[label](url)`.
 */
export async function sendDiscordNotification(
  webhookUrl: string,
  c: NotificationContent,
): Promise<void> {
  const description = [...c.lines, "", `[${c.ctaLabel}](${c.ctaUrl})`].join("\n");
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [
        {
          title: c.heading,
          description,
          url: c.ctaUrl,
          color: ACTION_PINK,
          footer: { text: `DSEC · ${c.eyebrow}` },
        },
      ],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Discord webhook ${res.status}: ${detail}`);
  }
}
