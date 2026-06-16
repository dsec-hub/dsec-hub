"use client";

import { useState } from "react";

import { Icons } from "@/components/icons";

/**
 * An inline link that renders alongside a small button to copy its URL.
 * Used by the Markdown renderer so links in docs can be both followed and
 * copied. The copy button is icon-only to keep it unobtrusive inside prose.
 */
export function CopyableLink({ href, children }: { href: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable (e.g. non-HTTPS); the link still works.
    }
  }

  return (
    <span className="inline-flex items-baseline gap-1">
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-accent-text underline underline-offset-2"
      >
        {children}
      </a>
      <button
        type="button"
        onClick={copy}
        title={copied ? "Copied" : `Copy ${href}`}
        aria-label={copied ? "Link copied" : "Copy link"}
        className="inline-flex translate-y-0.5 items-center text-muted/70 transition-colors hover:text-accent-text"
      >
        {copied ? (
          <Icons.check className="size-3.5" />
        ) : (
          <Icons.copy className="size-3.5" />
        )}
      </button>
    </span>
  );
}
