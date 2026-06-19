import "server-only";

/**
 * Branded HTML shell for committee-dashboard emails — the minimal developer-tool
 * look from the hub: cool off-white canvas, white card on a hairline border,
 * monospace titles (Geist Mono → mono fallback), Inter/system body, and DSEC's
 * single Action-Pink CTA. Table-based with inline styles so it renders the same
 * in Gmail and Outlook.
 *
 * New dashboard emails (onboarding, notifications, …) should route through
 * renderEmail() so they all share the brand.
 */

const C = {
  bg: "#f7f8fa", // page floor
  surface: "#ffffff", // card
  border: "#e6e8eb", // solid stand-in for the rgba hairline (email can't do alpha borders reliably)
  fg: "#0a0a0c", // near-black ink
  muted: "#5c6063", // secondary copy
  faint: "#8a8f94", // fine print
  pink: "#e91e63", // Action Pink — fills
  pinkText: "#c2185b", // AA-safe pink for text/links on white
} as const;

// NB: single-quote every font name — these strings get interpolated into
// double-quoted style="…" attributes, so a double quote here would terminate
// the attribute early and silently drop the rest of the CSS declaration.
const TITLE = `'Geist Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace`;
const BODY = `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`;

/** Escape DB/user-supplied text before interpolating into HTML. */
export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Bulletproof pink CTA — the table-cell carries the fill so Outlook keeps padding. */
export function emailButton(href: string, label: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
      <tr>
        <td align="center" bgcolor="${C.pink}" style="border-radius:8px;">
          <a href="${href}" target="_blank"
             style="display:inline-block;padding:12px 24px;border-radius:8px;font-family:${BODY};
                    font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">${esc(label)}</a>
        </td>
      </tr>
    </table>`;
}

/** Body paragraph, consistent muted ink. */
export function p(html: string): string {
  return `<p style="margin:0 0 18px;font-family:${BODY};font-size:14px;line-height:1.7;color:${C.muted};">${html}</p>`;
}

type EmailOpts = {
  preview: string;
  eyebrow?: string;
  heading: string;
  body: string;
};

/** Wrap inner body HTML in the full branded document. */
export function renderEmail({ preview, eyebrow, heading, body }: EmailOpts): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>DSEC Dashboard</title>
  <link href="https://fonts.googleapis.com/css2?family=Geist+Mono:wght@500;600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
  <style>
    body { margin:0 !important; padding:0 !important; width:100% !important; background:${C.bg}; }
    @media (max-width:520px){ .hub-wrap{ width:100% !important; } .hub-pad{ padding:32px 24px !important; } }
  </style>
</head>
<body style="margin:0;padding:0;background:${C.bg};">
  <span style="display:none !important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">${esc(preview)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.bg}" style="background:${C.bg};">
    <tr>
      <td align="center" style="padding:44px 16px;">
        <table role="presentation" class="hub-wrap" width="480" cellpadding="0" cellspacing="0" border="0" style="width:480px;max-width:480px;">

          <!-- Wordmark -->
          <tr>
            <td align="center" style="padding-bottom:30px;">
              <div style="font-family:${TITLE};font-size:18px;font-weight:600;letter-spacing:1px;color:${C.fg};">
                DSEC<span style="color:${C.pink};">.</span><span style="color:${C.muted};font-weight:500;"> dashboard</span>
              </div>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td bgcolor="${C.surface}" class="hub-pad"
                style="background:${C.surface};border:1px solid ${C.border};border-radius:12px;padding:40px 36px;">
              ${eyebrow ? `<div style="font-family:${TITLE};font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;color:${C.pinkText};margin:0 0 14px;">${esc(eyebrow)}</div>` : ""}
              <h1 style="margin:0 0 22px;font-family:${TITLE};font-size:19px;line-height:1.35;font-weight:600;color:${C.fg};">${esc(heading)}</h1>
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:32px 12px 6px;">
              <div style="font-family:${BODY};font-size:12px;color:${C.faint};">
                DSEC — Deakin Software Engineering Club &middot; committee dashboard
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export const emailColors = C;
