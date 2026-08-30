"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { FormError } from "@/components/form";
import { SubmitButton } from "@/components/submit-button";
import { Badge, EmptyState, SectionCard, buttonGhost } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/uploads";
import { useActionToast } from "@/lib/use-action-toast";
import type { AttachmentRow } from "@/lib/workspace-queries";

import {
  deleteSponsorDocument,
  uploadSponsorDocument,
  type FormState,
} from "../actions";

function formatBytes(n: number | null | undefined): string {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function SponsorDocuments({
  sponsorId,
  documents,
  canWrite,
}: {
  sponsorId: number;
  documents: AttachmentRow[];
  canWrite: boolean;
}) {
  const action = uploadSponsorDocument.bind(null, sponsorId);
  const [state, formAction] = useActionState<FormState, FormData>(action, undefined);
  useActionToast(state);
  const formRef = useRef<HTMLFormElement>(null);
  // Client-side courtesy: catch an oversized file instantly, before the browser
  // even attempts the upload (Vercel would otherwise reject the body with an
  // unexplained platform error). The server re-checks — this is never a control.
  const [sizeError, setSizeError] = useState<string | null>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <SectionCard title={`Documents · ${documents.length}`}>
      {documents.length === 0 ? (
        <EmptyState>No documents yet — upload agreements, decks, or logos (PDF/image).</EmptyState>
      ) : (
        <ul className="divide-y divide-border">
          {documents.map((d) => {
            const label = d.title || d.originalFilename || `Document ${d.id}`;
            const saved =
              d.originalSizeBytes && d.sizeBytes && d.originalSizeBytes > d.sizeBytes
                ? ` · saved ${Math.round((1 - d.sizeBytes / d.originalSizeBytes) * 100)}%`
                : "";
            return (
              <li key={d.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm font-medium hover:text-accent-text"
                  >
                    <Badge variant={d.kind === "pdf" ? "danger" : "accent"}>
                      {d.kind === "pdf" ? "PDF" : "Image"}
                    </Badge>
                    <span className="truncate">{label}</span>
                  </a>
                  <div className="truncate text-xs text-muted">
                    {formatBytes(d.sizeBytes)}
                    {saved} · {formatDate(d.createdAt)}
                  </div>
                </div>
                {canWrite && (
                  <form action={deleteSponsorDocument.bind(null, d.id, sponsorId)}>
                    <button className={buttonGhost} aria-label={`Delete ${label}`}>
                      Delete
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canWrite && (
        <form ref={formRef} action={formAction} className="space-y-3 border-t border-border px-5 py-4">
          <FormError>{sizeError ?? state?.error}</FormError>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="file"
              name="file"
              required
              accept="application/pdf,image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f && f.size > MAX_UPLOAD_BYTES) {
                  setSizeError(
                    `That file is ${(f.size / 1_000_000).toFixed(1)} MB. The maximum is ${MAX_UPLOAD_LABEL} — please compress the PDF (most exporters have a "reduced size" option) or link to it instead.`,
                  );
                  e.target.value = "";
                } else {
                  setSizeError(null);
                }
              }}
              className="text-sm text-muted file:mr-3 file:rounded-md file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-sm file:text-foreground"
            />
            <SubmitButton>Upload</SubmitButton>
          </div>
          <p className="text-xs text-muted/70">
            PDFs and images only, up to {MAX_UPLOAD_LABEL}. Images are compressed
            automatically; PDFs are uploaded as-is, so compress a large deck before
            uploading.
          </p>
        </form>
      )}
    </SectionCard>
  );
}
