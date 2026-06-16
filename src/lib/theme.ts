// Per-user theme: accent (primary) colour + separate title/body fonts. Saved on
// `app_user` (theme_accent / theme_font_title / theme_font_body) and applied as
// a CSS-variable override in the app layout. Pure module — safe to import from
// server and client.

const SANS = "ui-sans-serif, system-ui, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, monospace";
const SERIF = "ui-serif, Georgia, serif";

export type FontKind = "sans" | "mono" | "serif";
export type FontOption = {
  key: string;
  label: string;
  cssVar: string;
  stack: string;
  kind: FontKind;
};

// `cssVar` matches the next/font variable attached to <html> in app/layout.tsx.
export const FONT_OPTIONS: FontOption[] = [
  // Sans-serif
  { key: "inter", label: "Inter", cssVar: "--font-inter", stack: SANS, kind: "sans" },
  { key: "geist", label: "Geist", cssVar: "--font-geist", stack: SANS, kind: "sans" },
  { key: "figtree", label: "Figtree", cssVar: "--font-figtree", stack: SANS, kind: "sans" },
  { key: "jakarta", label: "Plus Jakarta Sans", cssVar: "--font-jakarta", stack: SANS, kind: "sans" },
  { key: "source", label: "Source Sans 3", cssVar: "--font-source", stack: SANS, kind: "sans" },
  { key: "manrope", label: "Manrope", cssVar: "--font-manrope", stack: SANS, kind: "sans" },
  { key: "outfit", label: "Outfit", cssVar: "--font-outfit", stack: SANS, kind: "sans" },
  { key: "dmsans", label: "DM Sans", cssVar: "--font-dmsans", stack: SANS, kind: "sans" },
  { key: "sora", label: "Sora", cssVar: "--font-sora", stack: SANS, kind: "sans" },
  // Monospace / technical
  { key: "spacegrotesk", label: "Space Grotesk", cssVar: "--font-spacegrotesk", stack: SANS, kind: "sans" },
  { key: "geist-mono", label: "Geist Mono", cssVar: "--font-geist-mono", stack: MONO, kind: "mono" },
  { key: "jetbrains", label: "JetBrains Mono", cssVar: "--font-jetbrains", stack: MONO, kind: "mono" },
  // Serif / display
  { key: "fraunces", label: "Fraunces", cssVar: "--font-fraunces", stack: SERIF, kind: "serif" },
  { key: "lora", label: "Lora", cssVar: "--font-lora", stack: SERIF, kind: "serif" },
];

// Titles default to Geist Mono (the brand display face); body to Inter.
export const DEFAULT_TITLE_FONT_KEY = "geist-mono";
export const DEFAULT_BODY_FONT_KEY = "inter";

// Curated accent presets (the first is DSEC's brand Action Pink). Users may also
// pick any custom hex.
export const ACCENT_PRESETS: { label: string; hex: string }[] = [
  { label: "Action Pink", hex: "#e91e63" },
  { label: "Violet", hex: "#7c5cff" },
  { label: "Blue", hex: "#2f6df6" },
  { label: "Teal", hex: "#11a89a" },
  { label: "Green", hex: "#1f9d57" },
  { label: "Amber", hex: "#e8910c" },
  { label: "Red", hex: "#e5193f" },
  { label: "Slate", hex: "#5c6b7a" },
];

export const DEFAULT_ACCENT = ACCENT_PRESETS[0].hex;

// Curated page-floor (`--background`) presets. A single stored value applied to
// both light and dark (like the accent), so these are chosen to read acceptably
// either way; users may also pick any custom hex. Null = the brand per-mode
// default (#f7f8fa light / #000000 dark).
export const BACKGROUND_PRESETS: { label: string; hex: string }[] = [
  { label: "Ink", hex: "#000000" },
  { label: "Charcoal", hex: "#0d0f12" },
  { label: "Graphite", hex: "#15171c" },
  { label: "Navy", hex: "#0b1020" },
  { label: "Plum", hex: "#140b16" },
  { label: "Paper", hex: "#f7f8fa" },
  { label: "Linen", hex: "#f4f0e8" },
  { label: "Mist", hex: "#eaeef3" },
];

// Selectable base text weights. `value` is the CSS font-weight. The defaults
// below mark the brand baseline (title = semibold, body = normal); selecting the
// default stores null (no override) so the stock utilities keep deciding.
export type WeightOption = { key: string; label: string; value: string };
export const WEIGHT_OPTIONS: WeightOption[] = [
  { key: "light", label: "Light", value: "300" },
  { key: "normal", label: "Normal", value: "400" },
  { key: "medium", label: "Medium", value: "500" },
  { key: "semibold", label: "Semibold", value: "600" },
  { key: "bold", label: "Bold", value: "700" },
];

export const DEFAULT_TITLE_WEIGHT_KEY = "semibold";
export const DEFAULT_BODY_WEIGHT_KEY = "normal";

export function weightByKey(
  key: string | null | undefined,
  fallback = DEFAULT_BODY_WEIGHT_KEY,
): WeightOption {
  return (
    WEIGHT_OPTIONS.find((w) => w.key === key) ??
    WEIGHT_OPTIONS.find((w) => w.key === fallback) ??
    WEIGHT_OPTIONS[1]
  );
}

/** A valid weight key, or null when it's empty/unknown/the given default. */
export function normalizeWeightKey(
  key: string | null | undefined,
  defaultKey: string,
): string | null {
  if (!key || key === defaultKey) return null;
  return WEIGHT_OPTIONS.some((w) => w.key === key) ? key : null;
}

/** Normalise a user-supplied colour to a `#rrggbb` string, or null if invalid.
 * Accepts `#rgb`, `#rrggbb`, with/without the leading `#`, any case. */
export function normalizeHex(input: string | null | undefined): string | null {
  if (!input) return null;
  let v = input.trim().toLowerCase().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/.test(v)) v = v.split("").map((c) => c + c).join("");
  if (!/^[0-9a-f]{6}$/.test(v)) return null;
  return `#${v}`;
}

export function fontByKey(key: string | null | undefined, fallback = DEFAULT_BODY_FONT_KEY): FontOption {
  return (
    FONT_OPTIONS.find((f) => f.key === key) ??
    FONT_OPTIONS.find((f) => f.key === fallback) ??
    FONT_OPTIONS[0]
  );
}

/** A valid font key, or null when it's empty/unknown/the given default. */
export function normalizeFontKey(
  key: string | null | undefined,
  defaultKey: string,
): string | null {
  if (!key || key === defaultKey) return null;
  return FONT_OPTIONS.some((f) => f.key === key) ? key : null;
}

/** WCAG relative luminance (0–1) of a `#rrggbb` colour. */
export function relativeLuminance(hex: string): number {
  const h = normalizeHex(hex) ?? DEFAULT_ACCENT;
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const r = channel(parseInt(h.slice(1, 3), 16));
  const g = channel(parseInt(h.slice(3, 5), 16));
  const b = channel(parseInt(h.slice(5, 7), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Readable foreground (near-black vs white) for text on the given accent,
 * using WCAG relative luminance. */
export function accentForeground(hex: string): string {
  return relativeLuminance(hex) > 0.45 ? "#1a0a10" : "#ffffff";
}

// Brand text inks, reused when a themed background drives the foreground.
const INK_DARK = "#0a0a0c"; // near-black ink for light surfaces
const INK_LIGHT = "#fcfdff"; // off-white ink for dark surfaces

export type SurfacePalette = {
  background: string;
  surface: string;
  elevated: string;
  foreground: string;
  muted: string;
  border: string;
  accentText: string;
  onDark: boolean;
};

/**
 * Derive a full, readable surface palette from a single chosen page colour.
 * The picked colour is the page floor (`--background`); the cards (`--surface`)
 * sit a touch lighter on top, `--elevated` (hover/active fills) leans toward the
 * text ink, and foreground/muted/border flip to stay legible on whatever was
 * chosen. So one Background choice themes the floor AND the cards coherently, in
 * both light and dark. Returns null for an empty/invalid value (brand default).
 */
export function surfacePalette(input: string | null | undefined): SurfacePalette | null {
  const bg = normalizeHex(input);
  if (!bg) return null;
  const onDark = relativeLuminance(bg) <= 0.45;
  const ink = onDark ? INK_LIGHT : INK_DARK;
  return {
    background: bg,
    surface: `color-mix(in srgb, ${bg}, #ffffff 7%)`,
    elevated: `color-mix(in srgb, ${bg}, ${ink} 9%)`,
    foreground: ink,
    muted: `color-mix(in srgb, ${ink} 58%, ${bg})`,
    border: onDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.1)",
    accentText: onDark ? "#ff5c8a" : "#c2185b",
    onDark,
  };
}

export type ThemeOverrides = {
  themeAccent?: string | null;
  themeBackground?: string | null;
  themeFontTitle?: string | null;
  themeFontBody?: string | null;
  themeWeightTitle?: string | null;
  themeWeightBody?: string | null;
};

/**
 * Build the CSS that overrides the brand theme for one user. The variable block
 * targets both `:root` and `.dark` (rendered after globals.css, so it wins for
 * either mode) so the chosen accent/background/fonts apply in light and dark.
 * Returns "" when the user has no overrides (falls back to the brand default).
 *
 * `--font-sans` drives body text; `--font-title` drives headings (h1–h3 /
 * .font-title), which fall back to the brand mono face when unset.
 *
 * Font weights are emitted as separate, deliberately high-specificity rules
 * (`:root h1…`, `body`) — and ONLY when set — so a chosen weight overrides the
 * stock `font-semibold`/`font-medium` utilities, while leaving the brand look
 * untouched when the user keeps the default.
 */
export function buildThemeCss({
  themeAccent,
  themeBackground,
  themeFontTitle,
  themeFontBody,
  themeWeightTitle,
  themeWeightBody,
}: ThemeOverrides): string {
  const decls: string[] = [];

  const accent = normalizeHex(themeAccent);
  if (accent) {
    // A custom accent drives the fill, its readable foreground, AND the text
    // variant (so accent links/badges track the user's colour rather than the
    // brand pink). The brand default keeps the dedicated --accent-text from CSS.
    decls.push(
      `--accent:${accent}`,
      `--accent-foreground:${accentForeground(accent)}`,
      `--accent-text:${accent}`,
    );
  }

  // A chosen background themes the whole surface stack — the page floor, the
  // cards on top (`--surface`) and raised fills (`--elevated`) all derive from
  // it, with the text ink flipped to stay readable on the result.
  const palette = surfacePalette(themeBackground);
  if (palette) {
    decls.push(
      `--background:${palette.background}`,
      `--surface:${palette.surface}`,
      `--elevated:${palette.elevated}`,
      `--foreground:${palette.foreground}`,
      `--muted:${palette.muted}`,
      `--border:${palette.border}`,
    );
    // Keep accent links/badges legible on the themed surface when the user kept
    // the brand accent (a custom accent already sets its own --accent-text).
    if (!accent) decls.push(`--accent-text:${palette.accentText}`);
  }

  const titleKey = normalizeFontKey(themeFontTitle, DEFAULT_TITLE_FONT_KEY);
  if (titleKey) {
    const f = fontByKey(titleKey);
    decls.push(`--font-title:var(${f.cssVar}),${f.stack}`);
  }

  const bodyKey = normalizeFontKey(themeFontBody, DEFAULT_BODY_FONT_KEY);
  if (bodyKey) {
    const f = fontByKey(bodyKey);
    decls.push(`--font-sans:var(${f.cssVar}),${f.stack}`);
  }

  const rules: string[] = [];
  if (decls.length > 0) rules.push(`:root,.dark{${decls.join(";")};}`);

  const titleWeight = normalizeWeightKey(themeWeightTitle, DEFAULT_TITLE_WEIGHT_KEY);
  if (titleWeight) {
    const w = weightByKey(titleWeight).value;
    rules.push(`:root h1,:root h2,:root h3,:root .font-title{font-weight:${w};}`);
  }

  const bodyWeight = normalizeWeightKey(themeWeightBody, DEFAULT_BODY_WEIGHT_KEY);
  if (bodyWeight) {
    rules.push(`body{font-weight:${weightByKey(bodyWeight).value};}`);
  }

  return rules.join("");
}
