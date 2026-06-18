"use server";

import { revalidatePath } from "next/cache";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { meetings } from "@/db/workspace-schema";
import { apiEnv } from "@/lib/api-env";
import { requireWrite } from "@/lib/dal";
import { canWriteCommittee } from "@/lib/rbac";
import { logMutation } from "@/lib/usage";

export type NotesState = { error?: string; ok?: string } | undefined;

/**
 * Generate AI minutes for a meeting by calling the dsec-api endpoint (which owns
 * the LLM + cost cap). Requires DSEC_API_URL + a DSEC_API_KEY with the `trigger`
 * scope. Degrades gracefully when not configured (the MCP tool also does this).
 */
export async function generateMeetingNotes(meetingId: number): Promise<NotesState> {
  const user = await requireWrite("meetings");
  // Scoped-owner guard: only generate notes for a meeting you may write.
  const [m] = await db
    .select({ committee: meetings.committee })
    .from(meetings)
    .where(eq(meetings.id, meetingId))
    .limit(1);
  if (!m) return { error: "Meeting not found." };
  if (!canWriteCommittee(user.viewConfig.committeeScope, user.userCommittee, m.committee)) {
    return { error: "You can only generate notes for your own committee's meetings." };
  }
  const env = apiEnv();
  if (!env) {
    return {
      error:
        "AI notes need DSEC_API_URL and a trigger-scoped DSEC_API_KEY set in the dashboard env. " +
        "(You can also run the MCP `generate_meeting_notes` tool from chat.)",
    };
  }
  try {
    const res = await fetch(`${env.base}/meetings/${meetingId}/generate-notes`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ create_document: true }),
    });
    if (!res.ok) {
      const detail = await res.text();
      return { error: `Notes generation failed (${res.status}): ${detail.slice(0, 200)}` };
    }
    await logMutation(user, "update", "meeting-notes", meetingId);
    revalidatePath(`/meetings/${meetingId}/edit`);
    revalidatePath("/meetings");
    return { ok: "Notes generated — summary, minutes, and action items saved to the meeting." };
  } catch (e) {
    return { error: `Could not reach the API: ${(e as Error).message}` };
  }
}
