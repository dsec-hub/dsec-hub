"use client";

import { useState } from "react";

import { Icons } from "@/components/icons";
import { cn } from "@/lib/format";
import { BUILT_IN_VIEWS } from "@/lib/task-view-helpers";
import type { SavedView } from "@/lib/task-view-types";

export function ViewSwitcher({
  activeKey,
  savedViews,
  dirty,
  busy,
  onSelect,
  onSaveNew,
  onUpdateActive,
  onDeleteActive,
}: {
  activeKey: string;
  savedViews: SavedView[];
  dirty: boolean;
  busy: boolean;
  onSelect: (key: string) => void;
  onSaveNew: (name: string) => void;
  onUpdateActive: () => void;
  onDeleteActive: (id: number) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");

  const activeSavedId = activeKey.startsWith("saved:") ? Number(activeKey.slice(6)) : null;

  function pill(key: string, label: string) {
    const isActive = key === activeKey;
    return (
      <button
        key={key}
        type="button"
        onClick={() => onSelect(key)}
        aria-pressed={isActive}
        className={cn(
          "shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors",
          isActive ? "bg-elevated font-medium text-foreground" : "text-muted hover:text-foreground",
        )}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1">
        {BUILT_IN_VIEWS.map((v) => pill(v.key, v.label))}
        {savedViews.length > 0 && <span className="mx-1 h-5 w-px shrink-0 bg-border" />}
        {savedViews.map((v) => pill(`saved:${v.id}`, v.name))}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {activeSavedId != null && dirty && (
          <button
            type="button"
            onClick={onUpdateActive}
            disabled={busy}
            className="rounded-md border border-border px-2.5 py-1.5 text-xs text-muted transition-colors hover:bg-elevated hover:text-foreground disabled:opacity-50"
          >
            Update view
          </button>
        )}
        {activeSavedId != null && (
          <button
            type="button"
            onClick={() => onDeleteActive(activeSavedId)}
            disabled={busy}
            aria-label="Delete this view"
            title="Delete this view"
            className="flex size-8 items-center justify-center rounded-md border border-border text-muted transition-colors hover:border-danger/40 hover:bg-danger/10 hover:text-danger disabled:opacity-50"
          >
            <Icons.close className="size-3.5" />
          </button>
        )}

        {saving ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const n = name.trim();
              if (!n) return;
              onSaveNew(n);
              setName("");
              setSaving(false);
            }}
            className="flex items-center gap-1.5"
          >
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setSaving(false)}
              placeholder="View name…"
              className="h-8 w-36 rounded-md border border-border bg-surface px-2.5 text-xs outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-accent px-2.5 py-1.5 text-xs font-medium text-accent-foreground disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setSaving(false)}
              className="rounded-md px-2 py-1.5 text-xs text-muted hover:text-foreground"
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setSaving(true)}
            className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-elevated hover:text-foreground"
          >
            + Save view
          </button>
        )}
      </div>
    </div>
  );
}
