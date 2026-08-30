"use client";

// Catches a failure in the root layout itself. Because the root layout has
// crashed, this file must render its own <html> and <body>. Keep it
// dependency-free (inline styles, no @/components imports) — the failure it
// handles may be caused by one of those imports.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en-AU">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "3rem", textAlign: "center" }}>
        <h1>DSEC hub is having a moment</h1>
        <p>Something broke badly enough that we could not render the page.</p>
        {error.digest ? (
          <p style={{ color: "#888", fontSize: "0.8rem" }}>Reference: {error.digest}</p>
        ) : null}
        <button type="button" onClick={() => reset()}>
          Try again
        </button>
      </body>
    </html>
  );
}
