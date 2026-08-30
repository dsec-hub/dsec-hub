"use client"; // error.tsx is always a Client Component.

import { useEffect } from "react";

import { buttonPrimary } from "@/components/ui";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Once OPS-01 lands, report to Sentry here instead.
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-foreground">Something went wrong</h1>
      <p className="mt-3 text-muted">
        That&rsquo;s on us, not you. Try again — if it keeps happening, let the
        committee know.
      </p>
      <button type="button" onClick={reset} className={`${buttonPrimary} mt-6`}>
        Try again
      </button>
      {/* In production Next strips error.message and gives a digest — show it so
          a report can be matched to a log line. */}
      {error.digest ? (
        <p className="mt-4 text-xs text-muted/70">Reference: {error.digest}</p>
      ) : null}
    </div>
  );
}
