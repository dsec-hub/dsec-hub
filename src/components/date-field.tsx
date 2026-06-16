"use client";

import { useEffect, useRef, useState } from "react";

import { controlBase } from "@/components/form";
import { Icons } from "@/components/icons";
import { cn, formatDate, todayISO } from "@/lib/format";

// A dependency-free date picker: a styled trigger that opens a month-grid
// calendar in a popover and writes an ISO (YYYY-MM-DD) value to a hidden input,
// so server actions keep reading it from FormData by `name`. Built in-house to
// match the app's hand-rolled controls and to render consistently in Safari/iOS,
// where native <input type="date"> draws its own chrome.

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type Month = { y: number; m: number }; // m is 0-based

const pad = (n: number) => String(n).padStart(2, "0");
const toISO = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/** Parse a YYYY-MM-DD string to its month, or null if empty/invalid. */
function monthOf(iso: string): Month | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? { y: Number(match[1]), m: Number(match[2]) - 1 } : null;
}

function thisMonth(): Month {
  const d = new Date();
  return { y: d.getFullYear(), m: d.getMonth() };
}

/** Shift a month by ±n, rolling the year over. */
function shiftMonth({ y, m }: Month, delta: number): Month {
  const total = m + delta;
  return { y: y + Math.floor(total / 12), m: ((total % 12) + 12) % 12 };
}

/** A 7-col grid: leading nulls for the weekday offset, then 1…daysInMonth. */
function buildGrid({ y, m }: Month): (number | null)[] {
  const offset = new Date(y, m, 1).getDay(); // 0 = Sunday
  const days = new Date(y, m + 1, 0).getDate();
  return [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
}

export function DateField({
  name,
  value,
  defaultValue,
  onChange,
  min,
  max,
  id,
  disabled,
  placeholder = "Select date",
  className,
}: {
  name: string;
  /** Controlled ISO value (YYYY-MM-DD). Omit for uncontrolled use. */
  value?: string;
  defaultValue?: string;
  onChange?: (iso: string) => void;
  /** Disable days before `min` / after `max` (ISO strings). */
  min?: string;
  max?: string;
  id?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue ?? "");
  const selected = isControlled ? value ?? "" : internal;

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<Month | null>(() => monthOf(defaultValue ?? value ?? ""));
  const rootRef = useRef<HTMLDivElement>(null);

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

  function commit(iso: string) {
    if (!isControlled) setInternal(iso);
    onChange?.(iso);
  }

  function toggle() {
    if (disabled) return;
    setView(monthOf(selected) ?? thisMonth());
    setOpen((o) => !o);
  }

  return (
    <div ref={rootRef} className="relative">
      <input type="hidden" name={name} value={selected} />
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          controlBase,
          "flex cursor-pointer items-center justify-between gap-2 text-left",
          !selected && "text-muted",
          className,
        )}
      >
        <span>{selected ? formatDate(selected) : placeholder}</span>
        <Icons.events className="size-4 shrink-0 text-muted" />
      </button>

      {open && view && (
        <div
          role="dialog"
          aria-label="Choose date"
          className="absolute left-0 z-50 mt-1.5 w-72 rounded-xl border border-border bg-surface p-3 shadow-xl"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setView(shiftMonth(view, -1))}
              aria-label="Previous month"
              className="rounded-md p-1.5 text-muted transition-colors hover:bg-elevated"
            >
              <Icons.chevron className="size-4 rotate-90" />
            </button>
            <div className="text-sm font-medium">
              {MONTHS[view.m]} {view.y}
            </div>
            <button
              type="button"
              onClick={() => setView(shiftMonth(view, 1))}
              aria-label="Next month"
              className="rounded-md p-1.5 text-muted transition-colors hover:bg-elevated"
            >
              <Icons.chevron className="size-4 -rotate-90" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center">
            {WEEKDAYS.map((w) => (
              <div key={w} className="py-1 text-xs font-medium text-muted/70">
                {w}
              </div>
            ))}
            {buildGrid(view).map((day, i) => {
              if (day === null) return <div key={i} />;
              const iso = toISO(view.y, view.m, day);
              const isSel = iso === selected;
              const isToday = iso === todayISO();
              const isDisabled = (!!min && iso < min) || (!!max && iso > max);
              return (
                <button
                  key={i}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => {
                    commit(iso);
                    setOpen(false);
                  }}
                  aria-label={formatDate(iso)}
                  aria-pressed={isSel}
                  className={cn(
                    "rounded-md py-1.5 text-sm transition-colors",
                    isDisabled && "cursor-not-allowed text-muted/30",
                    !isDisabled && !isSel && "hover:bg-elevated",
                    isSel && "bg-accent font-medium text-accent-foreground",
                    !isSel && isToday && "font-semibold text-accent-text",
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-xs">
            <button
              type="button"
              onClick={() => {
                const t = todayISO();
                commit(t);
                setOpen(false);
              }}
              className="font-medium text-accent-text hover:underline"
            >
              Today
            </button>
            {selected && (
              <button
                type="button"
                onClick={() => {
                  commit("");
                  setOpen(false);
                }}
                className="text-muted transition-colors hover:text-foreground hover:underline"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
