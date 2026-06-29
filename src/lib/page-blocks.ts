/**
 * Canonical custom-page block contract (shared, identical copy in dsec-hub +
 * dsec-website). The SERVER sanitizer is the source of truth:
 *   dsec-api  app/features/website/pageblocks.py
 *
 * A page's body is stored in Document.content_json as { version, blocks } and
 * rendered at https://dsec.club/<slug>. dsec-hub authors blocks with the editor
 * helpers below; dsec-website renders them. Keep all three in lock-step.
 */

export type Accent =
  | "blue" | "pink" | "yellow" | "mint" | "sky" | "violet" | "lime" | "coral";
export type ButtonVariant = "pink" | "ghost" | "blue" | "mint" | "void";
export type Align = "left" | "center";

export type ImageRef = {
  /** media_asset id the image came from (lets the dashboard re-find it). */
  mediaId?: number;
  /** display URL (WebP). Required for an image to render. */
  webp: string;
  /** full-res download URL (PNG/JPEG). */
  png?: string;
  alt?: string;
  width?: number;
  height?: number;
};

export type PageButton = { label: string; href: string; variant?: ButtonVariant };

export type HeroBlock = {
  id: string; type: "hero";
  eyebrow?: string; title?: string; subtitle?: string;
  image?: ImageRef; align?: Align; variant?: "banner" | "plain";
  buttons?: PageButton[];
};
export type HeadingBlock = {
  id: string; type: "heading";
  eyebrow?: string; title?: string; subtitle?: string; align?: Align;
};
export type RichTextBlock = { id: string; type: "richtext"; markdown?: string };
export type QuoteBlock = {
  id: string; type: "quote"; text?: string; attribution?: string;
};
export type ImageBlock = {
  id: string; type: "image";
  image?: ImageRef; caption?: string; width?: "full" | "wide" | "inset";
};
export type GalleryBlock = {
  id: string; type: "gallery"; images?: ImageRef[]; columns?: number;
};
export type EmbedBlock = {
  id: string; type: "embed";
  provider?: "youtube" | "vimeo" | "iframe";
  url?: string; caption?: string; ratio?: "16:9" | "4:3" | "1:1";
};
export type SplitBlock = {
  id: string; type: "split";
  image?: ImageRef; eyebrow?: string; title?: string; markdown?: string;
  imageSide?: "left" | "right"; buttons?: PageButton[];
};
export type ColumnsBlock = {
  id: string; type: "columns"; columns?: { markdown?: string }[];
};
export type CardItem = {
  title?: string; body?: string; image?: ImageRef; href?: string; accent?: Accent;
};
export type CardsBlock = {
  id: string; type: "cards";
  eyebrow?: string; title?: string; cards?: CardItem[]; columns?: number;
};
export type DividerBlock = { id: string; type: "divider"; variant?: "line" | "space" };
export type CtaBlock = {
  id: string; type: "cta";
  eyebrow?: string; title?: string; body?: string;
  buttons?: PageButton[]; align?: Align;
};
export type StatItem = { value?: string; label?: string; accent?: Accent };
export type StatsBlock = {
  id: string; type: "stats"; eyebrow?: string; title?: string; items?: StatItem[];
};
export type FaqItem = { q: string; a: string };
export type FaqBlock = {
  id: string; type: "faq"; eyebrow?: string; title?: string; items?: FaqItem[];
};
export type LogoItem = { name?: string; image: ImageRef; href?: string };
export type LogosBlock = {
  id: string; type: "logos";
  eyebrow?: string; title?: string; items?: LogoItem[]; marquee?: boolean;
};

export type Block =
  | HeroBlock | HeadingBlock | RichTextBlock | QuoteBlock
  | ImageBlock | GalleryBlock | EmbedBlock
  | SplitBlock | ColumnsBlock | CardsBlock | DividerBlock
  | CtaBlock | StatsBlock | FaqBlock | LogosBlock;

export type BlockType = Block["type"];

export type PageDoc = { version: number; blocks: Block[] };

export const ACCENTS: Accent[] = [
  "blue", "pink", "yellow", "mint", "sky", "violet", "lime", "coral",
];

export const BLOCK_TYPES: BlockType[] = [
  "hero", "heading", "richtext", "quote",
  "image", "gallery", "embed",
  "split", "columns", "cards", "divider",
  "cta", "stats", "faq", "logos",
];

export type BlockGroup =
  | "Heroes & text" | "Images & media" | "Layout" | "Marketing";

export type BlockKind = {
  type: BlockType;
  label: string;
  group: BlockGroup;
  hint: string;
};

/** Editor palette metadata, grouped by the four families. */
export const BLOCK_KINDS: BlockKind[] = [
  { type: "hero", label: "Hero", group: "Heroes & text", hint: "Big title, subtitle, background image + buttons" },
  { type: "heading", label: "Heading", group: "Heroes & text", hint: "Section eyebrow + title + intro" },
  { type: "richtext", label: "Rich text", group: "Heroes & text", hint: "Markdown prose" },
  { type: "quote", label: "Quote", group: "Heroes & text", hint: "Pull-quote / callout" },
  { type: "image", label: "Image", group: "Images & media", hint: "A single image with a caption" },
  { type: "gallery", label: "Gallery", group: "Images & media", hint: "A grid of images" },
  { type: "embed", label: "Video / embed", group: "Images & media", hint: "YouTube, Vimeo or an iframe" },
  { type: "split", label: "Image + text", group: "Layout", hint: "Image beside text, side-by-side" },
  { type: "columns", label: "Columns", group: "Layout", hint: "2–4 columns of markdown" },
  { type: "cards", label: "Cards", group: "Layout", hint: "Feature-card grid" },
  { type: "divider", label: "Divider", group: "Layout", hint: "A line or some breathing room" },
  { type: "cta", label: "Call to action", group: "Marketing", hint: "Title + body + buttons banner" },
  { type: "stats", label: "Stats", group: "Marketing", hint: "A band of numbers" },
  { type: "faq", label: "FAQ", group: "Marketing", hint: "Question / answer list" },
  { type: "logos", label: "Logo strip", group: "Marketing", hint: "Partner / sponsor logos" },
];

export const BLOCK_LABEL: Record<BlockType, string> = Object.fromEntries(
  BLOCK_KINDS.map((k) => [k.type, k.label]),
) as Record<BlockType, string>;

/** Stable id for a new block (crypto.randomUUID with a safe fallback). */
export function genId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return `b-${Math.abs(hashString(`${Date.now()}-${blockSeq++}`)).toString(36)}`;
}
let blockSeq = 0;
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

/** A fresh block of `type` with sensible empty defaults. */
export function newBlock(type: BlockType): Block {
  const id = genId();
  switch (type) {
    case "hero": return { id, type, title: "", subtitle: "", align: "left", variant: "banner", buttons: [] };
    case "heading": return { id, type, title: "", align: "left" };
    case "richtext": return { id, type, markdown: "" };
    case "quote": return { id, type, text: "" };
    case "image": return { id, type, width: "wide" };
    case "gallery": return { id, type, images: [], columns: 3 };
    case "embed": return { id, type, provider: "youtube", url: "", ratio: "16:9" };
    case "split": return { id, type, title: "", markdown: "", imageSide: "right", buttons: [] };
    case "columns": return { id, type, columns: [{ markdown: "" }, { markdown: "" }] };
    case "cards": return { id, type, cards: [], columns: 3 };
    case "divider": return { id, type, variant: "line" };
    case "cta": return { id, type, title: "", body: "", align: "center", buttons: [] };
    case "stats": return { id, type, items: [] };
    case "faq": return { id, type, items: [] };
    case "logos": return { id, type, items: [], marquee: false };
  }
}

/**
 * Tolerant parse of a stored content_json into a { version, blocks } doc. Keeps
 * only known block types and guarantees every block has an id. Never throws —
 * a corrupt payload yields an empty page rather than a crash.
 */
export function parsePageDoc(raw: unknown): PageDoc {
  const arr =
    raw && typeof raw === "object" && Array.isArray((raw as { blocks?: unknown }).blocks)
      ? (raw as { blocks: unknown[] }).blocks
      : Array.isArray(raw)
        ? raw
        : [];
  const blocks: Block[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const t = (item as { type?: unknown }).type;
    if (typeof t !== "string" || !BLOCK_TYPES.includes(t as BlockType)) continue;
    const b = item as Record<string, unknown>;
    const id = typeof b.id === "string" && b.id ? b.id : genId();
    blocks.push({ ...(b as object), id, type: t } as Block);
  }
  return { version: 1, blocks };
}

/** Serialize the editor's block list back to the stored shape. */
export function toPageDoc(blocks: Block[]): PageDoc {
  return { version: 1, blocks };
}
