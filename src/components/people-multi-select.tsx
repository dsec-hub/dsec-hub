"use client";

import { useMemo, useState } from "react";

type Option = { id: number; name: string };

/**
 * Pick several people for a multi-owner field. Native-form friendly: each chosen
 * id is emitted as a repeated hidden `<input name={name}>`, so a server action
 * reads them with `fd.getAll(name)` (see `coOwnerIdsOf`). Dependency-light — a
 * search box + a scrollable checkbox list + removable chips, no combobox lib.
 *
 * `excludeId` (the entity's primary owner) is hidden from the list so the same
 * person can't be both primary and co-owner; the server de-dupes regardless.
 */
export function PeopleMultiSelect({
  name,
  people,
  defaultSelected = [],
  excludeId,
  emptyHint = "No one selected yet.",
}: {
  name: string;
  people: Option[];
  defaultSelected?: number[];
  excludeId?: number | null;
  emptyHint?: string;
}) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set(defaultSelected));
  const [query, setQuery] = useState("");

  const available = useMemo(
    () => people.filter((p) => p.id !== excludeId),
    [people, excludeId],
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? available.filter((p) => p.name.toLowerCase().includes(q)) : available;
  }, [available, query]);
  const chosen = useMemo(
    () => available.filter((p) => selected.has(p.id)),
    [available, selected],
  );

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-2">
      {[...selected].map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}

      {chosen.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {chosen.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p.id)}
              className="inline-flex items-center gap-1 rounded-full border border-accent bg-accent/10 px-3 py-1 text-xs font-medium text-accent-text transition-colors hover:bg-accent/20"
            >
              {p.name}
              <span aria-hidden className="text-sm leading-none">×</span>
              <span className="sr-only">Remove {p.name}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted/70">{emptyHint}</p>
      )}

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search people…"
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
      />

      <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-surface">
        {filtered.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted/70">No matches.</p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((p) => {
              const active = selected.has(p.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => toggle(p.id)}
                    aria-pressed={active}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-elevated"
                  >
                    <span
                      className={
                        active
                          ? "flex h-4 w-4 shrink-0 items-center justify-center rounded border border-accent bg-accent text-[0.6rem] text-white"
                          : "h-4 w-4 shrink-0 rounded border border-border"
                      }
                      aria-hidden
                    >
                      {active ? "✓" : ""}
                    </span>
                    <span className="truncate">{p.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
