"use client";

import { useSyncExternalStore } from "react";

import { cn } from "@/lib/format";

/**
 * Display size + motion are purely client-side preferences, exactly like the
 * colour scheme (ThemeModeControl): they must resolve BEFORE first paint via the
 * root-layout script, so they can't come from the DB without a flash — and they
 * need no migration. Each is stored in localStorage and applied as a data-
 * attribute on <html> that globals.css keys off:
 *
 *   dsec-display → data-display="compact|large"  (font-size scale; "default" clears it)
 *   dsec-motion  → data-motion="reduce"          (forces reduced motion; "system" clears it)
 */

type Listener = () => void;

function makeStore(key: string, valid: string[], fallback: string, attr: string) {
  const listeners = new Set<Listener>();

  const subscribe = (cb: Listener) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
  };

  const getSnapshot = (): string => {
    try {
      const v = localStorage.getItem(key);
      return v && valid.includes(v) ? v : fallback;
    } catch {
      return fallback;
    }
  };

  // SSR / first paint assume the default; the before-paint script applies the
  // real stored value, and useSyncExternalStore reconciles on hydration.
  const getServerSnapshot = () => fallback;

  const apply = (v: string) => {
    const el = document.documentElement;
    if (v === fallback) delete el.dataset[attr];
    else el.dataset[attr] = v;
  };

  const set = (v: string) => {
    try {
      if (v === fallback) localStorage.removeItem(key);
      else localStorage.setItem(key, v);
    } catch {
      /* private mode / storage disabled — keep the in-page switch working */
    }
    apply(v);
    listeners.forEach((cb) => cb());
  };

  return { subscribe, getSnapshot, getServerSnapshot, set };
}

const displayStore = makeStore("dsec-display", ["compact", "default", "large"], "default", "display");
const motionStore = makeStore("dsec-motion", ["system", "reduce"], "system", "motion");

function RadioGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex rounded-lg border border-border bg-surface p-0.5"
    >
      {options.map((o) => {
        const selected = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              selected ? "bg-elevated text-foreground" : "text-muted hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const DISPLAY_OPTIONS = [
  { value: "compact", label: "Compact" },
  { value: "default", label: "Default" },
  { value: "large", label: "Large" },
];

const MOTION_OPTIONS = [
  { value: "system", label: "System" },
  { value: "reduce", label: "Reduced" },
];

export function DisplaySizeControl() {
  const value = useSyncExternalStore(
    displayStore.subscribe,
    displayStore.getSnapshot,
    displayStore.getServerSnapshot,
  );
  return (
    <RadioGroup label="Display size" value={value} options={DISPLAY_OPTIONS} onChange={displayStore.set} />
  );
}

export function MotionControl() {
  const value = useSyncExternalStore(
    motionStore.subscribe,
    motionStore.getSnapshot,
    motionStore.getServerSnapshot,
  );
  return <RadioGroup label="Motion" value={value} options={MOTION_OPTIONS} onChange={motionStore.set} />;
}
