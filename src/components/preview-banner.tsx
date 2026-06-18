"use client";

import { clearPreviewRole } from "@/app/(app)/admin/preview/actions";

/**
 * Persistent strip shown while an admin is previewing another role. Makes the
 * narrowed state unmissable and offers a one-click exit. Writes are disabled
 * server-side during preview (see dal.ts assertNotPreviewing).
 */
export function PreviewBanner({ roleName }: { roleName: string }) {
  return (
    <div
      role="status"
      className="sticky top-0 z-40 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-warning/30 bg-warning/10 px-4 py-2 text-sm text-foreground backdrop-blur"
    >
      <span className="inline-flex items-center gap-2">
        <span className="size-2 shrink-0 rounded-full bg-warning" aria-hidden />
        Previewing as <strong className="font-medium">{roleName}</strong>
        <span className="text-muted">· writes are disabled</span>
      </span>
      <form action={clearPreviewRole}>
        <button
          type="submit"
          className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-elevated"
        >
          Exit preview
        </button>
      </form>
    </div>
  );
}
