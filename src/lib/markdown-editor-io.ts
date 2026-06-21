/**
 * Two-way bridge between the Markdown stored on a document and the rich HTML the
 * WYSIWYG editor (components/markdown-editor.tsx) shows.
 *
 * - `markdownToEditorHtml` seeds the contentEditable once on mount.
 * - `editorHtmlToMarkdown` walks the live DOM back to Markdown on every edit, so
 *   the saved value — and the read-only <Markdown> renderer on the doc page —
 *   keep working unchanged.
 *
 * The supported syntax is deliberately the subset that components/markdown.tsx
 * renders: headings (#–####), **bold**, *italic*, `code`, [links](url),
 * ![images](url), bullet/numbered lists, > blockquotes, ``` code fences and
 * --- rules. Anything else (notably pipe tables) is preserved verbatim in a
 * non-editable raw block so a round-trip never destroys content.
 */

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

function isTableSeparator(line: string): boolean {
  const t = line.trim();
  if (!t.includes("|")) return false;
  const cells = t.replace(/^\||\|$/g, "").split("|");
  return cells.length >= 2 && cells.every((c) => /^\s*:?-+:?\s*$/.test(c));
}

/** Inline Markdown → HTML, mirroring the tokenizer in components/markdown.tsx. */
function inlineToHtml(text: string): string {
  const tokens = text.split(
    /(`[^`]+`|!\[[^\]]*\]\([^)]+\)|\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|\*[^*]+\*)/g,
  );
  return tokens
    .filter(Boolean)
    .map((tok) => {
      if (tok.startsWith("`") && tok.endsWith("`")) {
        return `<code class="md-code">${escapeHtml(tok.slice(1, -1))}</code>`;
      }
      const image = tok.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (image) {
        return `<img src="${escapeAttr(image[2])}" alt="${escapeAttr(image[1])}" />`;
      }
      const link = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) {
        // Stored on data-href (not href) so clicks never navigate away mid-edit.
        return `<a data-href="${escapeAttr(link[2])}" class="md-link">${escapeHtml(link[1])}</a>`;
      }
      if (tok.startsWith("**") && tok.endsWith("**")) {
        return `<strong>${escapeHtml(tok.slice(2, -2))}</strong>`;
      }
      if (tok.startsWith("*") && tok.endsWith("*")) {
        return `<em>${escapeHtml(tok.slice(1, -1))}</em>`;
      }
      return escapeHtml(tok);
    })
    .join("");
}

export function markdownToEditorHtml(md: string): string {
  const lines = (md ?? "").replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;

  const startsBlock = (l: string, idx: number) =>
    l.trim() === "" ||
    /^```/.test(l) ||
    /^(-{3,}|\*{3,}|_{3,})$/.test(l) ||
    /^#{1,4}\s+/.test(l) ||
    l.startsWith(">") ||
    /^[-*]\s+/.test(l) ||
    /^\d+\.\s+/.test(l) ||
    (l.includes("|") && idx + 1 < lines.length && isTableSeparator(lines[idx + 1]));

  while (i < lines.length) {
    const line = lines[i].replace(/\s+$/, "");

    // Fenced code block
    const fence = line.match(/^```\s*(\S*)\s*$/);
    if (fence) {
      const lang = fence[1] ?? "";
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i].trim())) {
        code.push(lines[i]);
        i++;
      }
      i++; // step past the closing fence
      out.push(
        `<pre data-lang="${escapeAttr(lang)}" class="md-pre"><code>${escapeHtml(code.join("\n")) || "<br>"}</code></pre>`,
      );
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) {
      out.push("<hr>");
      i++;
      continue;
    }

    // Pipe table → preserved verbatim (not richly editable)
    if (line.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const raw: string[] = [line];
      let j = i + 1;
      while (j < lines.length && lines[j].trim() !== "" && lines[j].includes("|")) {
        raw.push(lines[j].replace(/\s+$/, ""));
        j++;
      }
      const joined = raw.join("\n");
      out.push(
        `<div data-md="${escapeAttr(joined)}" contenteditable="false" class="md-raw">${escapeHtml(joined).replace(/\n/g, "<br>")}</div>`,
      );
      i = j;
      continue;
    }

    // Heading
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level}>${inlineToHtml(heading[2]) || "<br>"}</h${level}>`);
      i++;
      continue;
    }

    // Blockquote run (rendered recursively)
    if (line.startsWith(">")) {
      const inner: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        inner.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      out.push(`<blockquote>${markdownToEditorHtml(inner.join("\n"))}</blockquote>`);
      continue;
    }

    // Bullet / task list run
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i++;
      }
      out.push(`<ul>${items.map((t) => `<li>${inlineToHtml(t) || "<br>"}</li>`).join("")}</ul>`);
      continue;
    }

    // Numbered list run
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i++;
      }
      out.push(`<ol>${items.map((t) => `<li>${inlineToHtml(t) || "<br>"}</li>`).join("")}</ol>`);
      continue;
    }

    // Blank line → block separator (blocks already separate on serialize)
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Paragraph: gather consecutive plain lines; single newlines become <br>.
    const para: string[] = [];
    while (i < lines.length) {
      const l = lines[i].replace(/\s+$/, "");
      if (startsBlock(l, i)) break;
      para.push(l);
      i++;
    }
    out.push(`<p>${para.map((l) => inlineToHtml(l)).join("<br>")}</p>`);
  }

  return out.join("") || "<p><br></p>";
}

function imgMarkdown(img: HTMLImageElement): string {
  const src = img.getAttribute("src") || "";
  const alt = img.getAttribute("alt") || "";
  return `![${alt}](${src})`;
}

/** Serialize the inline children of an element back to Markdown. */
function serializeInline(el: HTMLElement): string {
  let out = "";
  el.childNodes.forEach((n) => {
    if (n.nodeType === Node.TEXT_NODE) {
      out += n.nodeValue ?? "";
      return;
    }
    if (n.nodeType !== Node.ELEMENT_NODE) return;
    const c = n as HTMLElement;
    switch (c.tagName) {
      case "BR":
        out += "\n";
        break;
      case "STRONG":
      case "B":
        out += `**${serializeInline(c)}**`;
        break;
      case "EM":
      case "I":
        out += `*${serializeInline(c)}*`;
        break;
      case "CODE":
        out += `\`${c.textContent ?? ""}\``;
        break;
      case "A": {
        const href = c.getAttribute("data-href") || c.getAttribute("href") || "";
        out += `[${serializeInline(c)}](${href})`;
        break;
      }
      case "IMG":
        out += imgMarkdown(c as HTMLImageElement);
        break;
      default: {
        // execCommand can emit <span style="font-weight:…"> instead of <b>/<i>.
        const style = c.getAttribute("style") || "";
        const bold = /font-weight\s*:\s*(bold|[6-9]00)/.test(style);
        const italic = /font-style\s*:\s*italic/.test(style);
        let inner = serializeInline(c);
        if (italic) inner = `*${inner}*`;
        if (bold) inner = `**${inner}**`;
        out += inner;
      }
    }
  });
  return out;
}

const BLOCK_TAGS = ["P", "DIV", "H1", "H2", "H3", "H4", "UL", "OL", "BLOCKQUOTE", "PRE"];

/** Serialize a single top-level (or blockquote-nested) node to a Markdown block. */
function serializeBlock(node: Node): string | null {
  if (node.nodeType === Node.TEXT_NODE) {
    const t = (node.nodeValue ?? "").trim();
    return t === "" ? null : t;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const el = node as HTMLElement;

  // Preserved raw block (e.g. a pipe table) round-trips byte-for-byte.
  const raw = el.getAttribute("data-md");
  if (raw != null) return raw;

  switch (el.tagName) {
    case "H1":
      return `# ${serializeInline(el)}`;
    case "H2":
      return `## ${serializeInline(el)}`;
    case "H3":
      return `### ${serializeInline(el)}`;
    case "H4":
    case "H5":
    case "H6":
      return `#### ${serializeInline(el)}`;
    case "HR":
      return "---";
    case "PRE": {
      const lang = el.getAttribute("data-lang") || "";
      const code = (el.textContent ?? "").replace(/\n$/, "");
      return "```" + lang + "\n" + code + "\n```";
    }
    case "UL":
      return Array.from(el.children)
        .filter((c) => c.tagName === "LI")
        .map((li) => `- ${serializeInline(li as HTMLElement)}`)
        .join("\n");
    case "OL":
      return Array.from(el.children)
        .filter((c) => c.tagName === "LI")
        .map((li, idx) => `${idx + 1}. ${serializeInline(li as HTMLElement)}`)
        .join("\n");
    case "BLOCKQUOTE": {
      const hasBlocks = Array.from(el.children).some((c) => BLOCK_TAGS.includes(c.tagName));
      const inner = hasBlocks
        ? Array.from(el.childNodes)
            .map(serializeBlock)
            .filter((x): x is string => x !== null && x !== "")
            .join("\n\n")
        : serializeInline(el);
      return inner
        .split("\n")
        .map((l) => (l === "" ? ">" : `> ${l}`))
        .join("\n");
    }
    case "IMG":
      return imgMarkdown(el as HTMLImageElement);
    case "BR":
      return null;
    default: {
      const md = serializeInline(el);
      return md.trim() === "" ? null : md;
    }
  }
}

export function editorHtmlToMarkdown(root: HTMLElement): string {
  const blocks: string[] = [];
  root.childNodes.forEach((node) => {
    const md = serializeBlock(node);
    if (md !== null && md !== "") blocks.push(md);
  });
  return blocks
    .join("\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
