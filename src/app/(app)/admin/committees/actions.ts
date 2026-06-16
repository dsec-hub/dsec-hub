"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { appInvite, committee, events, people } from "@/db/schema";
import { taskBoards, tasks } from "@/db/workspace-schema";
import { committeeUsage } from "@/lib/committee-queries";
import { requireAdmin } from "@/lib/dal";
import { bool, int, str } from "@/lib/form-data";
import { createToken, snapshotForDelete } from "@/lib/undo";
import type { ActionResult } from "@/lib/undo-types";

export type FormState = ActionResult;

function parseCommittee(fd: FormData) {
  const color = str(fd, "color");
  return {
    name: (str(fd, "name") ?? "").slice(0, 128),
    // Only accept a 6-digit hex; anything else falls back to "no colour".
    color: color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : null,
    description: str(fd, "description"),
    leadPersonId: int(fd, "lead_person_id"),
    isActive: bool(fd, "is_active"),
  };
}

async function nameTaken(name: string, exceptId?: number): Promise<boolean> {
  const dupe = await db
    .select({ id: committee.id })
    .from(committee)
    .where(
      exceptId
        ? and(sql`lower(${committee.name}) = lower(${name})`, ne(committee.id, exceptId))
        : sql`lower(${committee.name}) = lower(${name})`,
    )
    .limit(1);
  return dupe.length > 0;
}

// Committee changes ripple into every section that filters/groups by committee.
function revalidateCommittees() {
  revalidatePath("/admin/committees");
  revalidatePath("/people");
  revalidatePath("/events");
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
  revalidatePath("/");
}

export async function createCommittee(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const values = parseCommittee(fd);
  if (!values.name) return { error: "Committee name is required." };
  if (await nameTaken(values.name)) {
    return { error: "A committee with that name already exists." };
  }

  // Append new committees to the end of the display order.
  const [{ next } = { next: 0 }] = await db
    .select({ next: sql<number>`coalesce(max(${committee.sortOrder}), -1) + 1`.mapWith(Number) })
    .from(committee);

  const [row] = await db
    .insert(committee)
    .values({ ...values, sortOrder: next })
    .returning({ id: committee.id });
  revalidateCommittees();
  return { ok: true, message: "Committee created", undo: createToken("committee", row?.id) };
}

export async function updateCommittee(
  id: number,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  await requireAdmin();
  const [existing] = await db.select().from(committee).where(eq(committee.id, id)).limit(1);
  if (!existing) return { error: "Committee not found." };

  const values = parseCommittee(fd);
  if (!values.name) return { error: "Committee name is required." };
  if (await nameTaken(values.name, id)) {
    return { error: "A committee with that name already exists." };
  }

  const renamed = values.name !== existing.name;
  const now = new Date().toISOString();

  await db.transaction(async (tx) => {
    await tx.update(committee).set({ ...values, updatedAt: now }).where(eq(committee.id, id));
    if (renamed) {
      // Records elsewhere store the committee name as a string — cascade the
      // rename so nothing is left pointing at the old label.
      await tx.update(people).set({ committee: values.name, updatedAt: now }).where(eq(people.committee, existing.name));
      await tx.update(events).set({ committee: values.name, updatedAt: now }).where(eq(events.committee, existing.name));
      await tx.update(tasks).set({ committee: values.name, updatedAt: now }).where(eq(tasks.committee, existing.name));
      await tx.update(taskBoards).set({ committee: values.name }).where(eq(taskBoards.committee, existing.name));
      await tx.update(appInvite).set({ committee: values.name }).where(eq(appInvite.committee, existing.name));
    }
  });

  revalidateCommittees();
  // No undo token: a rename cascades across many rows, which the generic
  // single-row undo can't faithfully reverse. Create/delete stay undoable.
  return { ok: true, message: renamed ? "Committee renamed" : "Committee updated" };
}

export async function deleteCommittee(id: number): Promise<FormState> {
  await requireAdmin();
  const [existing] = await db.select().from(committee).where(eq(committee.id, id)).limit(1);
  if (!existing) return { error: "Committee not found." };

  const usage = await committeeUsage(existing.name);
  if (usage > 0) {
    return {
      error: `In use by ${usage} record${usage === 1 ? "" : "s"} — deactivate it instead, or reassign those records first.`,
    };
  }

  const undo = await snapshotForDelete("committee", id);
  await db.delete(committee).where(eq(committee.id, id));
  revalidateCommittees();
  return { ok: true, message: "Committee deleted", undo };
}
