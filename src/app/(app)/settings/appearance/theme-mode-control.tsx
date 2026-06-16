"use client";

import { useSyncExternalStore } from "react";

import { cn } from "@/lib/format";

// The colour scheme is a purely client-side preference (it must resolve before
// first paint via the root-layout script, so it can't come from the DB without a
// flash). "system" follows the OS; "light"/"dark" pin it. Stored in
// localStorage under `theme` — exactly what ThemeToggle and the no-flash script
// read — so this control and the sidebar toggle stay in sync.
type Mode = "system" | "light" | "dark";

const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): Mode {
  try {
    const t = localStorage.getItem("theme");
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

// SSR / first paint can't know the OS preference, so assume "system".
function getServerSnapshot(): Mode {
  return "system";
}

function applyResolved(mode: Mode) {
  const resolved =
    mode === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : mode;
  const el = document.documentElement;
  el.classList.toggle("dark", resolved === "dark");
  el.style.colorScheme = resolved;
}

function setMode(mode: Mode) {
  try {
    if (mode === "system") localStorage.removeItem("theme");
    else localStorage.setItem("theme", mode);
  } catch {
    /* private mode / storage disabled — keep the in-page switch working */
  }
  applyResolved(mode);
  listeners.forEach((cb) => cb());
}

const OPTIONS: { value: Mode; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function ThemeModeControl() {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <div
      role="radiogroup"
      aria-label="Colour scheme"
      className="inline-flex rounded-lg border border-border bg-surface p-0.5"
    >
      {OPTIONS.map((o) => {
        const selected = mode === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setMode(o.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              selected
                ? "bg-elevated text-foreground"
                : "text-muted hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
