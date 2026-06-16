"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { meetings, tasks, type Attendee } from "@/db/workspace-schema";
import { requireWrite } from "@/lib/dal";
import { int, str } from "@/lib/form-data";
import { logMutation } from "@/lib/usage";

export type FormState = { error?: string; ok?: boolean } | undefined;
export type MeetingRow = typeof meetings.$inferSelect;

/**
 * Attendees arrive as a JSON array of { personId?, name } from the picker. Falls
 * back to comma-separated names for resilience. Null when empty.
 */
function parseAttendees(fd: FormData): Attendee[] | null {
  const raw = str(fd, "attendees");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const list: Attendee[] = parsed
        .map((a) =>
          typeof a === "string"
            ? { name: a.trim() }
            : { personId: a?.personId ?? null, name: String(a?.name ?? "").trim() },
        )
        .filter((a) => a.name);
      return list.length ? list : null;
    }
  } catch {
    // not JSON — fall through to comma-separated parsing
  }
  const list: Attendee[] = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((name) => ({ name }));
  return list.length ? list : null;
}

function parseMeeting(fd: FormData) {
  return {
    title: str(fd, "title") ?? "",
    type: str(fd, "type"),
    meetingDate: str(fd, "meeting_date"),
    location: str(fd, "location"),
    status: str(fd, "status"),
    attendees: parseAttendees(fd),
    relatedEventId: int(fd, "related_event_id"),
    transcript: str(fd, "transcript"),
    summary: str(fd, "summary"),
    notes: str(fd, "notes"),
  };
}

function revalidateMeetings() {
  revalidatePath("/meetings");
  revalidatePath("/dashboard");
}

export async function createMeeting(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireWrite("meetings");
  const values = parseMeeting(fd);
  if (!values.title) return { error: "Title is required." };
  const [row] = await db.insert(meetings).values(values).returning({ id: meetings.id });
  await logMutation(user, "create", "meeting", row?.id);
  revalidateMeetings();
  return { ok: true };
}

export async function updateMeeting(
  id: number,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const user = await requireWrite("meetings");
  const values = parseMeeting(fd);
  if (!values.title) return { error: "Title is required." };
  await db
    .update(meetings)
    .set({ ...values, updatedAt: new Date().toISOString() })
    .where(eq(meetings.id, id));
  await logMutation(user, "update", "meeting", id);
  revalidateMeetings();
  redirect("/meetings");
}

export async function archiveMeeting(id: number): Promise<void> {
  const user = await requireWrite("meetings");
  await db
    .update(meetings)
    .set({ archived: true, updatedAt: new Date().toISOString() })
    .where(eq(meetings.id, id));
  await logMutation(user, "archive", "meeting", id);
  revalidateMeetings();
  redirect("/meetings");
}

export async function deleteMeeting(id: number): Promise<void> {
  const user = await requireWrite("meetings");
  await db.delete(meetings).where(eq(meetings.id, id));
  await logMutation(user, "delete", "meeting", id);
  revalidateMeetings();
  redirect("/meetings");
}

/**
 * Turn one of a meeting's action items into a real task on the global board —
 * the high-quality-tool move (Notion/Linear) of making decisions actionable.
 * The new task inherits the meeting's related event (so it threads through the
 * connections graph) and records its provenance in the description. The action
 * item's free-text `owner`/`due` are kept in the description; only a real
 * ISO date is promoted to the task's dueDate. Requires meetings write.
 */
export async function createTaskFromActionItem(
  meetingId: number,
  index: number,
): Promise<void> {
  const user = await requireWrite("meetings");
  const [meeting] = await db
    .select({
      title: meetings.title,
      actionItems: meetings.actionItems,
      relatedEventId: meetings.relatedEventId,
    })
    .from(meetings)
    .where(eq(meetings.id, meetingId))
    .limit(1);
  if (!meeting) return;

  const item = (meeting.actionItems ?? [])[index];
  if (!item?.text) return;

  const isoDue = item.due && /^\d{4}-\d{2}-\d{2}$/.test(item.due) ? item.due : null;
  const desc = [
    `From meeting: ${meeting.title}`,
    item.owner ? `Owner: ${item.owner}` : null,
    item.due && !isoDue ? `Due (as noted): ${item.due}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const [row] = await db
    .insert(tasks)
    .values({
      title: item.text,
      status: "To Do",
      dueDate: isoDue,
      relatedEventId: meeting.relatedEventId ?? null,
      description: desc,
    })
    .returning({ id: tasks.id });
  await logMutation(user, "create", "task", row?.id);
  revalidatePath(`/meetings/${meetingId}`);
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}
