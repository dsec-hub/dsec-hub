// Controlled vocabularies for the workspace features (tasks, projects, meetings,
// documents). Kept separate from lib/options.ts to avoid touching that shared
// file. Used to populate form <select>s and to drive status colours.

import type { BadgeVariant } from "@/lib/options";
import type { Attendee } from "@/db/workspace-schema";

export const TASK_PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;

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
