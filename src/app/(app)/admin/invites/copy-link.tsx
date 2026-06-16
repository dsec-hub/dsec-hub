"use client";

import { useState } from "react";

import { buttonSecondary } from "@/components/ui";

export function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable (e.g. non-HTTPS); the input is selectable.
    }
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <input
        readOnly
        value={link}
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-muted outline-none"
      />
      <button type="button" onClick={copy} className={buttonSecondary}>
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
