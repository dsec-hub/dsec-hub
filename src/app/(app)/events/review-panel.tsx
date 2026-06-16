"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createReviewForm } from "./actions";
import { EmptyState, SectionCard, buttonPrimary, buttonSecondary } from "@/components/ui";
import { cn } from "@/lib/format";
import type { ReviewSummary } from "@/lib/reviews";

/**
 * Post-event review panel on the event edit page. With no form yet it offers a
 * one-click "Create review form" (calls the dsec-api, which owns the Tally key);
 * once created it shows the shareable link, a copy button, and best-effort live
 * response stats. The link is visible to everyone; only writers can create one.
 */
export function ReviewPanel({
  eventId,
  formUrl,
  summary,
  canWrite = true,
}: {
  eventId: number;
  formUrl: string | null;
  summary: ReviewSummary | null;
  canWrite?: boolean;
}) {
  const [pending, start] = useTransition();

  const onCreate = () =>
    start(async () => {
      const res = await createReviewForm(eventId);
      if (res?.error) toast.error(res.error);
      else toast.success(res?.message ?? "Review form created");
    });

  if (formUrl) {
    return (
      <SectionCard title="Post-event review">
        <ReviewLink formUrl={formUrl} summary={summary} />
      </SectionCard>
    );
  }

  if (!canWrite) {
    return (
      <SectionCard title="Post-event review">
        <EmptyState>No review form for this event yet.</EmptyState>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Post-event review">
      <div className="px-5 py-6">
        <p className="max-w-prose text-sm text-muted">
          Create a short, anonymous feedback form for attendees — a quick star rating
          plus what they enjoyed and what to improve next time. Best shared right after
          the event.
        </p>
        <button
          type="button"
          className={cn(buttonPrimary, "mt-4")}
          onClick={onCreate}
          disabled={pending}
        >
          {pending ? "Creating…" : "Create review form"}
        </button>
      </div>
    </SectionCard>
  );
}

function ReviewLink({
  formUrl,
  summary,
}: {
  formUrl: string;
  summary: ReviewSummary | null;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(formUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy — select the link and copy it manually.");
    }
  };

  return (
    <div className="flex flex-col gap-4 px-5 py-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          readOnly
          value={formUrl}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full flex-1 rounded-md border border-border bg-elevated px-3 py-2 text-sm text-muted outline-none"
        />
        <div className="flex shrink-0 gap-2">
          <button type="button" className={buttonSecondary} onClick={copy}>
            {copied ? "Copied!" : "Copy link"}
          </button>
          <a
            className={buttonSecondary}
            href={formUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open form ↗
          </a>
        </div>
      </div>

      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
        {summary ? (
          <>
            <span>
              <span className="font-medium text-foreground tabular-nums">
                {summary.responseCount}
              </span>{" "}
              response{summary.responseCount === 1 ? "" : "s"}
            </span>
            {summary.averageRating != null && (
              <span>
                avg{" "}
                <span className="font-medium text-foreground tabular-nums">
                  {summary.averageRating.toFixed(1)}
                </span>{" "}
                ★
              </span>
            )}
          </>
        ) : (
          <span>Share this link with attendees — responses are collected in Tally.</span>
        )}
      </p>
    </div>
  );
}
