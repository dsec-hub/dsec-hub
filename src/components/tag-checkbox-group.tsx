"use client";

import { useState } from "react";

/**
 * A group of checkboxes over a fixed vocabulary, serialised to a hidden input as
 * a JSON string array (parsed back with `jsonList` in a server action). Used for
 * multi-value fields like sponsor/event support types.
 */
export function TagCheckboxGroup({
  id,
  name,
  options,
  defaultValue,
}: {
  /** Injected by Field. A group of toggles has no single focusable control, so
   *  instead of naming one button we mark the wrapper as a role="group" and
   *  point it at Field's <label> via aria-labelledby (`${id}-label`). The id
   *  also lives on the wrapper so Field's label htmlFor isn't an orphan. */
  id?: string;
  name: string;
  options: readonly string[];
  defaultValue?: string[] | null;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(defaultValue ?? []),
  );

  function toggle(value: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  return (
    <div id={id} role="group" aria-labelledby={id ? `${id}-label` : undefined}>
      <input type="hidden" name={name} value={JSON.stringify([...selected])} />
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = selected.has(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              aria-pressed={active}
              className={
                active
                  ? "rounded-full border border-accent bg-accent/10 px-3 py-1 text-xs font-medium text-accent-text transition-colors"
                  : "rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted transition-colors hover:bg-elevated"
              }
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
