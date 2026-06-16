"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { SectionCard, buttonGhost } from "@/components/ui";
import { cn } from "@/lib/format";

import { createTaskFromActionItem } from "../actions";

type Item = { text: string; owner?: string | null; due?: string | null };

/**
 * A meeting's action items, each convertible into a task on the global board
 * (the connection between "what we decided" and "what gets done"). The convert
 * button is gated on meetings-write; it inherits the meeting's related event.
 */
export function MeetingActionItems({
  meetingId,
  items,
  canWrite,
}: {
  meetingId: number;
  items: Item[];
  canWrite: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <SectionCard title={`Action items (${items.length})`} className="mb-6">
      <ul className="divide-y divide-border">
        {items.map((a, i) => (
          <li key={i} className="flex items-start justify-between gap-3 px-5 py-3">
            <div className="min-w-0">
              <div className="text-sm">{a.text}</div>
              <div className="mt-0.5 text-xs text-muted">
                {a.owner ?? "Unassigned"}
                {a.due ? ` · due ${a.due}` : ""}
              </div>
            </div>
            {canWrite && (
              <button
                type="button"
                disabled={pending}
                className={cn(buttonGhost, "shrink-0")}
                onClick={() =>
                  startTransition(async () => {
                    await createTaskFromActionItem(meetingId, i);
                    toast.success("Task created from action item");
                  })
                }
              >
                + Task
              </button>
            )}
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
