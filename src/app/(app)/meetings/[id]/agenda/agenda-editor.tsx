"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { Field, SelectField, TextArea, TextInput } from "@/components/form";
import { Icons } from "@/components/icons";
import { SubmitButton } from "@/components/submit-button";
import { buttonGhost, buttonSecondary } from "@/components/ui";
import type { AgendaItem } from "@/db/workspace-schema";
import { formatDuration } from "@/lib/agenda";
import { cn } from "@/lib/format";

import type { FormState } from "./actions";

type Option = { id: number; name: string };
type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

/** Editor-local draft: every control binds a string (selects/inputs want strings)
 * and each row carries a stable `id` from creation so reorders + the public link
 * stay consistent across saves without a round-trip. */
type Draft = {
  id: string;
  title: string;
  ownerPersonId: string;
  duration: string;
  notes: string;
  relatedTaskId: string;
  relatedEventId: string;
};

function genId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function toDraft(item: AgendaItem): Draft {
  return {
    id: item.id || genId(),
    title: item.title ?? "",
    ownerPersonId: item.owner_person_id != null ? String(item.owner_person_id) : "",
    duration: item.duration_minutes != null ? String(item.duration_minutes) : "",
    notes: item.notes ?? "",
    relatedTaskId: item.related_task_id != null ? String(item.related_task_id) : "",
    relatedEventId: item.related_event_id != null ? String(item.related_event_id) : "",
  };
}

function emptyDraft(): Draft {
  return { id: genId(), title: "", ownerPersonId: "", duration: "", notes: "", relatedTaskId: "", relatedEventId: "" };
}

function serialise(drafts: Draft[]) {
  return drafts
    .map((d, i) => ({
      id: d.id,
      order: i,
      title: d.title.trim(),
      owner_person_id: d.ownerPersonId ? Number(d.ownerPersonId) : null,
      duration_minutes: d.duration.trim() ? Number(d.duration) : null,
      notes: d.notes.trim() || null,
      related_task_id: d.relatedTaskId ? Number(d.relatedTaskId) : null,
      related_event_id: d.relatedEventId ? Number(d.relatedEventId) : null,
    }))
    .filter((p) => p.title);
}

export function AgendaEditor({
  initialItems,
  people,
  events,
  tasks,
  canWrite,
  action,
}: {
  initialItems: AgendaItem[];
  people: Option[];
  events: Option[];
  tasks: Option[];
  canWrite: boolean;
  action: Action;
}) {
  const [items, setItems] = useState<Draft[]>(() => initialItems.map(toDraft));
  const [state, formAction] = useActionState(action, undefined);

  useEffect(() => {
    if (state?.error) toast.error(state.error);
    else if (state?.ok) toast.success("Agenda saved");
  }, [state]);

  const payload = serialise(items);
  const totalMinutes = payload.reduce((s, p) => s + (p.duration_minutes ?? 0), 0);

  function patch(id: string, key: keyof Draft, value: string) {
    setItems((prev) => prev.map((d) => (d.id === id ? { ...d, [key]: value } : d)));
  }
  function remove(id: string) {
    setItems((prev) => prev.filter((d) => d.id !== id));
  }
  function move(index: number, dir: -1 | 1) {
    setItems((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }
  function add() {
    setItems((prev) => [...prev, emptyDraft()]);
  }

  return (
    <form action={formAction} className="space-y-4">
      {/* The whole agenda travels as one JSON field, like the attendees picker. */}
      <input type="hidden" name="items" value={JSON.stringify(payload)} />

      {items.length === 0 && (
        <p className="rounded-xl border border-dashed border-border bg-surface px-5 py-10 text-center text-sm text-muted">
          No agenda items yet. {canWrite ? "Add the first one below." : ""}
        </p>
      )}

      <ol className="space-y-3">
        {items.map((d, i) => (
          <li key={d.id} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-start gap-3">
              <span className="mt-2 grid size-6 shrink-0 place-items-center rounded-full bg-elevated text-xs font-medium text-muted tabular-nums">
                {i + 1}
              </span>
              <fieldset disabled={!canWrite} className="min-w-0 flex-1 space-y-3">
                <div className="flex items-start gap-2">
                  <TextInput
                    aria-label="Agenda item title"
                    placeholder="Agenda item"
                    value={d.title}
                    onChange={(e) => patch(d.id, "title", e.target.value)}
                    className="flex-1"
                  />
                  {canWrite && (
                    <div className="flex shrink-0 items-center">
                      <button
                        type="button"
                        onClick={() => move(i, -1)}
                        disabled={i === 0}
                        aria-label="Move up"
                        className={cn(buttonGhost, "px-1.5 disabled:opacity-30")}
                      >
                        <Icons.chevron className="size-4 rotate-180" />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(i, 1)}
                        disabled={i === items.length - 1}
                        aria-label="Move down"
                        className={cn(buttonGhost, "px-1.5 disabled:opacity-30")}
                      >
                        <Icons.chevron className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(d.id)}
                        aria-label="Remove item"
                        className={cn(buttonGhost, "px-1.5 hover:text-danger")}
                      >
                        <Icons.close className="size-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Owner">
                    <SelectField
                      value={d.ownerPersonId}
                      onChange={(e) => patch(d.id, "ownerPersonId", e.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {people.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </SelectField>
                  </Field>
                  <Field label="Duration (minutes)">
                    <TextInput
                      type="number"
                      min={0}
                      step={5}
                      inputMode="numeric"
                      placeholder="—"
                      value={d.duration}
                      onChange={(e) => patch(d.id, "duration", e.target.value)}
                    />
                  </Field>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Related task" hint="Optional — link a board task.">
                    <SelectField
                      value={d.relatedTaskId}
                      onChange={(e) => patch(d.id, "relatedTaskId", e.target.value)}
                    >
                      <option value="">—</option>
                      {tasks.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </SelectField>
                  </Field>
                  <Field label="Related event" hint="Optional — link an event.">
                    <SelectField
                      value={d.relatedEventId}
                      onChange={(e) => patch(d.id, "relatedEventId", e.target.value)}
                    >
                      <option value="">—</option>
                      {events.map((ev) => (
                        <option key={ev.id} value={ev.id}>
                          {ev.name}
                        </option>
                      ))}
                    </SelectField>
                  </Field>
                </div>

                <Field label="Notes" hint="Markdown supported.">
                  <TextArea
                    value={d.notes}
                    onChange={(e) => patch(d.id, "notes", e.target.value)}
                    className="min-h-16"
                    placeholder="Context, links, talking points…"
                  />
                </Field>
              </fieldset>
            </div>
          </li>
        ))}
      </ol>

      {canWrite && (
        <button type="button" onClick={add} className={cn(buttonSecondary, "w-full")}>
          + Add agenda item
        </button>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
        <span className="text-sm text-muted tabular-nums">
          {payload.length} item{payload.length === 1 ? "" : "s"}
          {totalMinutes > 0 ? ` · ${formatDuration(totalMinutes)} total` : ""}
        </span>
        {canWrite && <SubmitButton>Save agenda</SubmitButton>}
      </div>
    </form>
  );
}
