import "server-only";

import { headers } from "next/headers";

import { renderEmail, emailButton, p, esc } from "@/lib/email-layout";

/**
 * Resolve the app's public origin for building invite links.
 *
 * Prefers APP_URL. In production we REQUIRE it: invite links carry a single-use
 * token sent by email, so deriving the origin from the (spoofable) `Host` /
 * `x-forwarded-proto` headers would let a forged Host turn an admin-triggered
 * invite into a token-exfiltration link pointing at an attacker domain. Only in
 * dev do we fall back to the request headers for convenience.
 */
export async function getAppUrl(): Promise<string> {
  const fromEnv = process.env.APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "APP_URL must be set in production to build invite links (refusing to trust the Host header).",
    );
  }
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

type InviteEmail = {
  to: string;
  link: string;
  roleName: string;
  committee?: string | null;
  invitedBy?: string | null;
};

/**
 * Send an invite email via the Resend HTTP API (no SDK dependency).
 * Degrades gracefully: with no RESEND_API_KEY set, it logs the link and reports
 * `sent: false` so the admin UI can surface the copyable link instead.
 */
export async function sendInviteEmail({
  to,
  link,
  roleName,
  committee,
  invitedBy,
}: InviteEmail): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "DSEC Dashboard <onboarding@resend.dev>";

  if (!apiKey) {
    console.info(`[invite] RESEND_API_KEY not set — share this link manually:\n  ${link}`);
    return { sent: false };
  }

  const by = invitedBy ? ` by <strong style="color:#0a0a0c;">${esc(invitedBy)}</strong>` : "";
  const onCommittee = committee
    ? ` on the <strong style="color:#0a0a0c;">${esc(committee)}</strong> committee`
    : "";
  const html = renderEmail({
    preview: `You've been invited to the DSEC committee dashboard as ${roleName}.`,
    eyebrow: "You're invited",
    heading: "Join the DSEC dashboard",
    body: `
      ${p(
        `You've been invited${by} to join the DSEC exec dashboard with the <strong style="color:#0a0a0c;">${esc(
          roleName,
        )}</strong> role${onCommittee}. Set your password to get started.`,
      )}
      <div style="margin:28px 0;">${emailButton(link, "Accept invite")}</div>
      <p style="margin:0;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#8a8f94;">
        Or paste this link into your browser:<br>
        <a href="${link}" target="_blank" style="color:#c2185b;word-break:break-all;">${esc(link)}</a><br><br>
        This link expires in 7 days. If you weren't expecting this, you can ignore it.
      </p>`,
  });

  const text = [
    `You've been invited${invitedBy ? ` by ${invitedBy}` : ""} to join the DSEC exec dashboard`,
    `with the ${roleName} role${committee ? ` on the ${committee} committee` : ""}.`,
    ``,
    `Accept your invite and set your password:`,
    link,
    ``,
    `This link expires in 7 days. If you weren't expecting this, you can ignore it.`,
  ].join("\n");

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject: "You've been invited to the DSEC Dashboard",
        html,
        text,
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      console.error(`[invite] Resend error ${res.status}: ${detail}`);
      return { sent: false, error: `Email failed (${res.status}). Share the link manually.` };
    }
    return { sent: true };
  } catch (err) {
    console.error("[invite] Resend request failed:", err);
    return { sent: false, error: "Email request failed. Share the link manually." };
  }
}
