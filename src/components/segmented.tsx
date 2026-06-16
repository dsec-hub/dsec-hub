"use client";

import { cn } from "@/lib/format";

/** Small segmented control (pill toggle) for switching between views. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex rounded-lg border border-border bg-surface p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            "rounded-md px-3 py-1 text-sm transition-colors",
            value === o.value
              ? "bg-accent text-accent-foreground"
              : "text-muted hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
