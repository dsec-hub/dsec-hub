"use client";

import { useEffect, useRef } from "react";

import { Icons } from "@/components/icons";

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Lightweight, dependency-free modal. Renders nothing when closed so the form
 * inside remounts (and resets) on every open. Closes on backdrop click, the X
 * button, and Escape; locks body scroll while open. Manages focus for keyboard
 * and screen-reader users: moves focus into the dialog on open, traps Tab inside
 * it, and restores focus to the trigger on close.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  size = "default",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  // "wide" gives multi-section flows (the two-stage create modals) more room.
  size?: "default" | "wide";
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Move focus into the dialog (first focusable, else the dialog itself).
    const focusables = () =>
      Array.from(dialog?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    (focusables()[0] ?? dialog)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      // Trap Tab within the dialog so focus can't reach the page behind it.
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="animate-fade-in fixed inset-0 bg-black/50"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={
          "animate-pop-in relative z-10 my-4 w-full rounded-xl border border-border bg-background shadow-xl outline-none sm:my-8 " +
          (size === "wide" ? "max-w-5xl" : "max-w-3xl")
        }
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-medium">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 place-items-center rounded-md text-muted transition-colors hover:bg-elevated hover:text-foreground"
          >
            <Icons.close />
          </button>
        </div>
        <div className="max-h-[85vh] overflow-y-auto px-6 pt-5 pb-4">{children}</div>
      </div>
    </div>
  );
}
