"use client";

import { useEffect, useRef, useState } from "react";

import { controlBase } from "@/components/form";
import { Icons } from "@/components/icons";
import { cn, formatTime } from "@/lib/format";

// A dependency-free time picker: a styled trigger that opens a scrollable list of
// fixed increments in a popover and writes an "HH:MM" (24h) value to a hidden
// input, so server actions keep reading it from FormData by `name`. Built in-house
// to mirror DateField and the app's other hand-rolled controls, and to render
// consistently in Safari/iOS, where native <input type="time"> draws its own
// chrome. A saved value that falls off the increment grid is injected as its own
// slot so editing an event never silently snaps or drops its time.

const pad = (n: number) => String(n).padStart(2, "0");

/** All "HH:MM" slots across a day at the given minute step (e.g. 15 → 96 slots). */
function buildSlots(stepMin: number): string[] {
  const out: string[] = [];
  for (let mins = 0; mins < 24 * 60; mins += stepMin) {
    out.push(`${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`);
  }
  return out;
}

export function TimeField({
  name,
  value,
  onChange,
  step = 15,
  disabled,
  className,
  placeholder = "—",
}: {
  name: string;
  /** Controlled "HH:MM" value (accepts "HH:MM:SS" too — seconds are ignored). */
  value: string;
  onChange: (hhmm: string) => void;
  /** Increment between slots in minutes. */
  step?: number;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const current = value ? value.slice(0, 5) : "";
  const slots = buildSlots(step);
  // Keep an off-grid saved time (e.g. 18:05) selectable rather than dropping it.
  if (current && !slots.includes(current)) {
    slots.push(current);
    slots.sort();
  }

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  // Close on outside click / Escape while open.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // On open, centre the selected slot in the scroll area so the list doesn't
  // start at midnight. Scroll the container directly (not scrollIntoView) so the
  // surrounding page/modal never jumps.
  useEffect(() => {
    if (!open) return;
    const el = selectedRef.current;
    const box = listRef.current;
    if (el && box) box.scrollTop = el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2;
  }, [open]);

  function commit(hhmm: string) {
    onChange(hhmm);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <input type="hidden" name={name} value={current} />
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          controlBase,
          "flex cursor-pointer items-center justify-between gap-2 text-left",
          !current && "text-muted",
          className,
        )}
      >
        <span>{current ? formatTime(current) : placeholder}</span>
        <Icons.clock className="size-4 shrink-0 text-muted" />
      </button>

      {open && (
        <div
          ref={listRef}
          role="listbox"
          aria-label="Choose time"
          className="absolute left-0 z-50 mt-1.5 max-h-60 w-44 overflow-y-auto rounded-xl border border-border bg-surface p-1.5 shadow-xl"
        >
          {current && (
            <button
              type="button"
              onClick={() => commit("")}
              className="mb-1 block w-full rounded-md px-3 py-1.5 text-left text-xs text-muted transition-colors hover:bg-elevated hover:text-foreground"
            >
              Clear
            </button>
          )}
          {slots.map((t) => {
            const isSel = t === current;
            return (
              <button
                key={t}
                ref={isSel ? selectedRef : undefined}
                type="button"
                role="option"
                aria-selected={isSel}
                onClick={() => commit(t)}
                className={cn(
                  "block w-full rounded-md px-3 py-1.5 text-left text-sm transition-colors",
                  !isSel && "hover:bg-elevated",
                  isSel && "bg-accent font-medium text-accent-foreground",
                )}
              >
                {formatTime(t)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
