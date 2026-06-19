import "server-only";

import { emailButton, esc, p, renderEmail } from "@/lib/email-layout";

import type { NotificationContent } from "../types";

/**
 * Deliver a notification by email via the Resend HTTP API, reusing the branded
 * shell from `email-layout.ts`. Mirrors `sendInviteEmail`'s graceful
 * degradation: with no RESEND_API_KEY it logs and returns (dev no-op) rather
 * than throwing, so a missing key never marks the send as failed.
 */
export async function sendEmailNotification(to: string, c: NotificationContent): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "DSEC Dashboard <onboarding@resend.dev>";

  const bodyHtml =
    c.lines.map((line) => p(esc(line))).join("") +
    `<div style="margin:28px 0;">${emailButton(c.ctaUrl, c.ctaLabel)}</div>`;
  const html = renderEmail({
    preview: c.heading,
    eyebrow: c.eyebrow,
    heading: c.heading,
    body: bodyHtml,
  });
  const text = [c.heading, "", ...c.lines, "", `${c.ctaLabel}: ${c.ctaUrl}`].join("\n");

  if (!apiKey) {
    console.info(`[notify:email] RESEND_API_KEY not set — would send "${c.heading}" to ${to}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject: c.heading, html, text }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${detail}`);
  }
}
