// Controlled vocabularies for the workspace features (tasks, projects, meetings,
// documents). Kept separate from lib/options.ts to avoid touching that shared
// file. Used to populate form <select>s and to drive status colours.

import type { BadgeVariant } from "@/lib/options";
import type { Attendee } from "@/db/workspace-schema";

export const TASK_PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;

/**
 * `dim`/`value` in reassignTask come straight from the drag-and-drop client.
 * `priority` is varchar(16) and `committee` is varchar(128), so an unvalidated
 * value long enough to overflow either column raises Postgres 22001 out of a
 * `Promise<void>` Server Action that catches nothing — and dsec-hub has no
 * error.tsx, so the user lands on Next's bare crash page and loses the board.
 * "__none__" is the client's sentinel for "clear this field".
 *
 * `null` means "clear it", a string means "set it", and `undefined` means
 * "reject this request".
 */
export function validPriority(value: string): string | null | undefined {
  if (!value || value === "__none__") return null;
  return (TASK_PRIORITIES as readonly string[]).includes(value) ? value : undefined;
}

/** Display name for an attendee, tolerating legacy plain-string rows. */
export function attendeeName(a: Attendee | string): string {
  return typeof a === "string" ? a : a.name;
}

/** Normalise stored attendees (which may be legacy strings) to objects. */
export function normaliseAttendees(
  raw: (Attendee | string)[] | null | undefined,
): Attendee[] {
  if (!raw) return [];
  return raw
    .map((a) => (typeof a === "string" ? { name: a } : a))
    .filter((a) => a.name?.trim());
}

export const PROJECT_STATUSES = [
  "Idea",
  "Active",
  "On Hold",
  "Completed",
  "Showcased",
] as const;

export const MEETING_TYPES = ["Committee", "Exec", "Sponsorship", "General", "Other"] as const;
export const MEETING_STATUSES = ["Scheduled", "Held", "NotesDraft", "NotesFinal"] as const;

export const DOC_TYPES = [
  "Note",
  "MeetingNotes",
  "SponsorDoc",
  "Deliverable",
  "Policy",
  "General",
  // A document published as a public page at dsec.club/<slug>. Selecting this
  // type reveals the "Publish as page" panel (slug + nav + blocks) on the edit
  // page.
  "Page",
] as const;
export const DOC_STATUSES = ["Draft", "InReview", "Final"] as const;

export const DEFAULT_BOARD_COLUMNS = ["Backlog", "To Do", "In Progress", "Done"] as const;

export function projectStatusVariant(s: string | null): BadgeVariant {
  switch (s) {
    case "Completed":
    case "Showcased":
      return "success";
    case "Active":
      return "accent";
    case "Idea":
    case "On Hold":
      return "warning";
    default:
      return "neutral";
  }
}

export function priorityVariant(p: string | null): BadgeVariant {
  switch (p) {
    case "Urgent":
      return "danger";
    case "High":
      return "warning";
    case "Medium":
      return "accent";
    default:
      return "neutral";
  }
}

export function docStatusVariant(s: string | null): BadgeVariant {
  switch (s) {
    case "Final":
      return "success";
    case "InReview":
      return "accent";
    case "Draft":
      return "warning";
    default:
      return "neutral";
  }
}

export function meetingStatusVariant(s: string | null): BadgeVariant {
  switch (s) {
    case "NotesFinal":
    case "Held":
      return "success";
    case "NotesDraft":
      return "accent";
    case "Scheduled":
      return "warning";
    default:
      return "neutral";
  }
}
