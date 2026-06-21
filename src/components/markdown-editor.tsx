"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/format";
import { editorHtmlToMarkdown, markdownToEditorHtml } from "@/lib/markdown-editor-io";

/**
 * Live, in-house WYSIWYG Markdown editor. The contentEditable holds real block
 * elements (h1, ul, blockquote, …) styled — via `.md-editor` in globals.css — to
 * match the read-only <Markdown> renderer, so authoring is what-you-see. The DOM
 * is serialized back to Markdown on every edit into a hidden <input>, keeping the
 * stored value (and the public doc page) on plain Markdown. No editor libraries.
 */

// ---- selection / DOM helpers (browser-only, module scope) -------------------

/** The direct child of `editor` that currently contains the caret. */
function activeBlock(editor: HTMLElement): HTMLElement | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  let node: Node | null = sel.anchorNode;
  if (!node) return null;
  if (node === editor) {
    const child = editor.childNodes[sel.anchorOffset] ?? editor.lastChild;
    return (child as HTMLElement) ?? null;
  }
  while (node && node.parentNode !== editor) node = node.parentNode;
  return (node as HTMLElement) ?? null;
}

/** Text from the start of `block` up to the caret. */
function textBeforeCaret(block: HTMLElement): string {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return "";
  const caret = sel.getRangeAt(0);
  const pre = document.createRange();
  pre.selectNodeContents(block);
  try {
    pre.setEnd(caret.endContainer, caret.endOffset);
  } catch {
    return "";
  }
  return pre.toString();
}

/** Delete the first `n` characters of `block`, then drop the caret at its start. */
function deleteLeading(block: HTMLElement, n: number) {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  const first = walker.nextNode() as Text | null;
  if (!first) return;
  let acc = 0;
  let endNode: Text = first;
  let endOff = 0;
  let cur: Text | null = first;
  while (cur) {
    const len = cur.nodeValue?.length ?? 0;
    if (acc + len >= n) {
      endNode = cur;
      endOff = n - acc;
      break;
    }
    acc += len;
    cur = walker.nextNode() as Text | null;
  }
  const range = document.createRange();
  range.setStart(first, 0);
  range.setEnd(endNode, endOff);
  range.deleteContents();
  const sel = window.getSelection();
  const caret = document.createRange();
  caret.setStart(block, 0);
  caret.collapse(true);
  sel?.removeAllRanges();
  sel?.addRange(caret);
}

function formatBlock(tag: string) {
  document.execCommand("formatBlock", false, `<${tag}>`);
}

function caretAtEndOf(block: HTMLElement): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const r = sel.getRangeAt(0);
  const after = document.createRange();
  after.selectNodeContents(block);
  try {
    after.setStart(r.endContainer, r.endOffset);
  } catch {
    return false;
  }
  return after.toString().length === 0;
}

function insertTextAtCaret(text: string) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const r = sel.getRangeAt(0);
  r.deleteContents();
  const node = document.createTextNode(text);
  r.insertNode(node);
  r.setStartAfter(node);
  r.collapse(true);
  sel.removeAllRanges();
  sel.addRange(r);
}

function placeCaretAfter(el: Node) {
  const sel = window.getSelection();
  const r = document.createRange();
  r.setStartAfter(el);
  r.collapse(true);
  sel?.removeAllRanges();
  sel?.addRange(r);
}

function placeCaretAtStart(el: Node) {
  const sel = window.getSelection();
  const r = document.createRange();
  r.setStart(el, 0);
  r.collapse(true);
  sel?.removeAllRanges();
  sel?.addRange(r);
}

/** Replace `block` with an (optionally pre-filled) code block; caret lands inside. */
function convertToCodeBlock(block: HTMLElement, lang: string, initialText: string) {
  const pre = document.createElement("pre");
  pre.setAttribute("data-lang", lang);
  pre.className = "md-pre";
  const code = document.createElement("code");
  const text = document.createTextNode(initialText);
  code.appendChild(text);
  pre.appendChild(code);
  block.replaceWith(pre);
  const sel = window.getSelection();
  const r = document.createRange();
  r.setStart(text, initialText.length);
  r.collapse(true);
  sel?.removeAllRanges();
  sel?.addRange(r);
}

function convertToHr(block: HTMLElement) {
  const hr = document.createElement("hr");
  const p = document.createElement("p");
  p.appendChild(document.createElement("br"));
  block.replaceWith(hr);
  hr.after(p);
  placeCaretAtStart(p);
}

function lastTextNode(root: Node): Text | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let last: Text | null = null;
  let n = walker.nextNode();
  while (n) {
    last = n as Text;
    n = walker.nextNode();
  }
  return last;
}

function exitCodeBlock(block: HTMLElement) {
  const code = block.querySelector("code") ?? block;
  const last = lastTextNode(code);
  if (last && last.nodeValue?.endsWith("\n")) {
    last.nodeValue = last.nodeValue.replace(/\n$/, "");
  }
  const p = document.createElement("p");
  p.appendChild(document.createElement("br"));
  block.after(p);
  placeCaretAtStart(p);
}

/** "# ", "- ", "1. ", "> " at line start convert the block as you type. */
function applyBlockShortcut(editor: HTMLElement) {
  const block = activeBlock(editor);
  if (!block) return;
  if (block.tagName !== "P" && block.tagName !== "DIV") return;
  const t = textBeforeCaret(block);
  let m: RegExpMatchArray | null;
  if ((m = t.match(/^(#{1,4}) $/))) {
    deleteLeading(block, m[0].length);
    formatBlock(`h${m[1].length}`);
  } else if (/^[-*] $/.test(t)) {
    deleteLeading(block, 2);
    document.execCommand("insertUnorderedList");
  } else if ((m = t.match(/^\d+\. $/))) {
    deleteLeading(block, m[0].length);
    document.execCommand("insertOrderedList");
  } else if (/^> $/.test(t)) {
    deleteLeading(block, 2);
    formatBlock("blockquote");
  }
}

/** Inline autoformat fired on the closing marker: `code`, **bold**, *italic*, [t](u). */
function applyInlineShortcut(data: string) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const node = sel.anchorNode;
  if (!node || node.nodeType !== Node.TEXT_NODE) return;
  const textNode = node as Text;
  const caret = sel.anchorOffset;
  const before = (textNode.nodeValue ?? "").slice(0, caret);

  const wrap = (matchLen: number, content: string, tag: string, className?: string) => {
    const start = caret - matchLen;
    const range = document.createRange();
    range.setStart(textNode, start);
    range.setEnd(textNode, caret);
    range.deleteContents();
    const el = document.createElement(tag);
    if (className) el.className = className;
    el.textContent = content;
    range.insertNode(el);
    placeCaretAfter(el);
  };

  let m: RegExpMatchArray | null;
  if (data === "`") {
    if ((m = before.match(/`([^`]+)`$/))) wrap(m[0].length, m[1], "code", "md-code");
  } else if (data === "*") {
    if ((m = before.match(/\*\*([^*]+)\*\*$/))) wrap(m[0].length, m[1], "strong");
    else if ((m = before.match(/\*([^*]+)\*$/))) wrap(m[0].length, m[1], "em");
  } else if (data === ")") {
    if ((m = before.match(/\[([^\]]+)\]\(([^)]+)\)$/))) {
      const start = caret - m[0].length;
      const range = document.createRange();
      range.setStart(textNode, start);
      range.setEnd(textNode, caret);
      range.deleteContents();
      const a = document.createElement("a");
      a.setAttribute("data-href", m[2]);
      a.className = "md-link";
      a.textContent = m[1];
      range.insertNode(a);
      placeCaretAfter(a);
    }
  }
}

// ---- component --------------------------------------------------------------

type Props = {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  canWrite?: boolean;
  id?: string;
  className?: string;
};

export function MarkdownEditor({
  name,
  defaultValue = "",
  placeholder = "Write…",
  canWrite = true,
  id,
  className,
}: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const initialized = useRef(false);

  const refreshEmpty = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const empty =
      (editor.textContent ?? "").trim() === "" &&
      !editor.querySelector("img, hr, pre, [data-md]");
    editor.dataset.empty = empty ? "true" : "false";
  };

  const sync = () => {
    const editor = editorRef.current;
    const hidden = hiddenRef.current;
    if (!editor || !hidden) return;
    hidden.value = editorHtmlToMarkdown(editor);
    refreshEmpty();
  };

  // Seed the editor exactly once. After this, React never touches its children,
  // so re-renders (e.g. a server-action result) can't clobber what was typed.
  useEffect(() => {
    const editor = editorRef.current;
    const hidden = hiddenRef.current;
    if (!editor || !hidden || initialized.current) return;
    initialized.current = true;
    editor.innerHTML = markdownToEditorHtml(defaultValue);
    hidden.value = defaultValue ?? "";
    try {
      document.execCommand("defaultParagraphSeparator", false, "p");
      document.execCommand("styleWithCSS", false, "false");
    } catch {
      /* best-effort; the editor still works without these */
    }
    refreshEmpty();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const editor = editorRef.current;
    if (!editor) return;
    const native = e.nativeEvent as InputEvent;
    if (native.inputType === "insertText" && native.data === " ") {
      applyBlockShortcut(editor);
    } else if (native.inputType === "insertText" && native.data && "`*)".includes(native.data)) {
      applyInlineShortcut(native.data);
    }
    sync();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const editor = editorRef.current;
    if (!editor || e.key !== "Enter" || e.shiftKey) return;
    const block = activeBlock(editor);
    if (!block) return;

    if (block.tagName === "PRE") {
      e.preventDefault();
      const text = block.textContent ?? "";
      if (caretAtEndOf(block) && text.endsWith("\n")) {
        exitCodeBlock(block);
      } else {
        insertTextAtCaret("\n");
      }
      sync();
      return;
    }

    if (block.tagName === "P" || block.tagName === "DIV") {
      const t = (block.textContent ?? "").trim();
      const fence = t.match(/^```\s*(\S*)$/);
      if (fence) {
        e.preventDefault();
        convertToCodeBlock(block, fence[1] ?? "", "");
        sync();
        return;
      }
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) {
        e.preventDefault();
        convertToHr(block);
        sync();
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    // Insert as plain text so pasted rich HTML can't poison the serialized output.
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
    sync();
  };

  // Toolbar commands run while the editor keeps focus (see onMouseDown below).
  const run = (fn: () => void) => {
    editorRef.current?.focus();
    fn();
    sync();
  };

  const toggleBlock = (tag: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    const current = activeBlock(editor)?.tagName.toLowerCase();
    formatBlock(current === tag ? "p" : tag);
  };

  const wrapInlineSelection = (tag: string, className?: string) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    const text = range.toString();
    range.deleteContents();
    const el = document.createElement(tag);
    if (className) el.className = className;
    el.textContent = text;
    range.insertNode(el);
    placeCaretAfter(el);
  };

  const insertCodeBlock = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const block = activeBlock(editor);
    if (!block || !["P", "DIV", "H1", "H2", "H3", "H4"].includes(block.tagName)) return;
    convertToCodeBlock(block, "", block.textContent ?? "");
  };

  const insertLink = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const range = sel.getRangeAt(0).cloneRange();
    const text = range.toString();
    const url = window.prompt("Link URL", "https://");
    if (!url) return;
    range.deleteContents();
    const a = document.createElement("a");
    a.setAttribute("data-href", url);
    a.className = "md-link";
    a.textContent = text || url;
    range.insertNode(a);
    placeCaretAfter(a);
  };

  return (
    <div className={cn("overflow-hidden rounded-md border border-border bg-surface", className)}>
      {canWrite && (
        <div
          className="flex flex-wrap items-center gap-0.5 border-b border-border px-2 py-1.5"
          // Keep the caret/selection in the editor when a button is pressed.
          onMouseDown={(e) => e.preventDefault()}
        >
          <ToolButton title="Heading 1" onClick={() => run(() => toggleBlock("h1"))}>
            H1
          </ToolButton>
          <ToolButton title="Heading 2" onClick={() => run(() => toggleBlock("h2"))}>
            H2
          </ToolButton>
          <ToolButton title="Heading 3" onClick={() => run(() => toggleBlock("h3"))}>
            H3
          </ToolButton>
          <Divider />
          <ToolButton title="Bold (⌘B)" className="font-semibold" onClick={() => run(() => document.execCommand("bold"))}>
            B
          </ToolButton>
          <ToolButton title="Italic (⌘I)" className="italic" onClick={() => run(() => document.execCommand("italic"))}>
            I
          </ToolButton>
          <ToolButton title="Inline code" onClick={() => run(() => wrapInlineSelection("code", "md-code"))}>
            {"<>"}
          </ToolButton>
          <ToolButton title="Link" onClick={() => run(insertLink)}>
            Link
          </ToolButton>
          <Divider />
          <ToolButton title="Bulleted list" onClick={() => run(() => document.execCommand("insertUnorderedList"))}>
            •
          </ToolButton>
          <ToolButton title="Numbered list" onClick={() => run(() => document.execCommand("insertOrderedList"))}>
            1.
          </ToolButton>
          <ToolButton title="Quote" onClick={() => run(() => toggleBlock("blockquote"))}>
            &ldquo;
          </ToolButton>
          <ToolButton title="Code block" onClick={() => run(insertCodeBlock)}>
            {"{ }"}
          </ToolButton>
        </div>
      )}
      <div
        ref={editorRef}
        id={id}
        contentEditable={canWrite}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Document content"
        data-placeholder={placeholder}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        className="md-editor h-[60vh] min-h-80 overflow-y-auto px-4 py-3 text-sm leading-relaxed outline-none"
      />
      <input ref={hiddenRef} type="hidden" name={name} />
    </div>
  );
}

function ToolButton({
  children,
  onClick,
  title,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "rounded px-2 py-1 font-mono text-xs text-muted transition-colors hover:bg-elevated hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-border" />;
}
