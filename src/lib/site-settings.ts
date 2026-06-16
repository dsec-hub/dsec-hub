// Definitions for the global, admin-editable site links surfaced on the
// Settings page. PURE (no server/db imports) so both the server page and the
// client form can import it. Keys are stored as rows in the `app_setting`
// table (see scripts/setup-settings.ts).

export type SiteLinkField = {
  key: string;
  label: string;
  placeholder: string;
  /** `email` renders a mailto-friendly input; everything else is a URL. */
  type?: "url" | "email";
};

export const SITE_LINK_FIELDS: SiteLinkField[] = [
  { key: "social_instagram", label: "Instagram", placeholder: "https://instagram.com/dsec" },
  { key: "social_discord", label: "Discord", placeholder: "https://discord.gg/…" },
  { key: "social_linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/company/dsec" },
  { key: "social_github", label: "GitHub", placeholder: "https://github.com/dsec" },
  { key: "social_youtube", label: "YouTube", placeholder: "https://youtube.com/@dsec" },
  { key: "social_website", label: "Website", placeholder: "https://dsec.org.au" },
  { key: "social_email", label: "Contact email", placeholder: "hello@dsec.org.au", type: "email" },
];

export const SITE_LINK_KEYS = SITE_LINK_FIELDS.map((f) => f.key);
