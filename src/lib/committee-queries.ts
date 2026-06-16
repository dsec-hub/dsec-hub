import "server-only";

import { asc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { appInvite, committee, events, people } from "@/db/schema";
import { taskBoards, tasks } from "@/db/workspace-schema";

export type CommitteeRow = {
  id: number;
  name: string;
  color: string | null;
  description: string | null;
  leadPersonId: number | null;
  leadName: string | null;
  isActive: boolean;
  sortOrder: number;
  peopleCount: number;
  createdAt: string;
};

/** Shape passed to form <select>s — the stored value is the committee *name*. */
export type CommitteeOption = { id: number; name: string; color: string | null };

// How many roster records sit in each committee (correlated; aliased `pc` so it
// doesn't clash with the lead-name join on `people`).
const peopleCount = sql<number>`(select count(*) from ${people} pc where pc.committee = ${committee.name})`.mapWith(
  Number,
);

const COMMITTEE_FIELDS = {
  id: committee.id,
  name: committee.name,
  color: committee.color,
  description: committee.description,
  leadPersonId: committee.leadPersonId,
  leadName: people.name,
  isActive: committee.isActive,
  sortOrder: committee.sortOrder,
  peopleCount,
  createdAt: committee.createdAt,
};

/** Every committee with its lead name + roster count, ordered for display. */
export async function getCommittees(): Promise<CommitteeRow[]> {
  return db
    .select(COMMITTEE_FIELDS)
    .from(committee)
    .leftJoin(people, eq(committee.leadPersonId, people.id))
    .orderBy(asc(committee.sortOrder), asc(committee.name));
}

export async function getCommitteeById(id: number): Promise<CommitteeRow | undefined> {
  const [row] = await db
    .select(COMMITTEE_FIELDS)
    .from(committee)
    .leftJoin(people, eq(committee.leadPersonId, people.id))
    .where(eq(committee.id, id))
    .limit(1);
  return row;
}

/** Active committees for pickers (people/events/tasks/invites). */
export async function getCommitteeOptions(): Promise<CommitteeOption[]> {
  return db
    .select({ id: committee.id, name: committee.name, color: committee.color })
    .from(committee)
    .where(eq(committee.isActive, true))
    .orderBy(asc(committee.sortOrder), asc(committee.name));
}

/**
 * Does a committee with this name exist (active or not)? Used as light, defensive
 * validation in server actions. Null/empty is always allowed. Fails OPEN: if the
 * table doesn't exist yet (pre-migration) or the query errors, we don't block the
 * save — the form dropdown already constrains normal input.
 */
export async function isKnownCommittee(name: string | null | undefined): Promise<boolean> {
  if (!name) return true;
  try {
    const [row] = await db
      .select({ id: committee.id })
      .from(committee)
      .where(sql`lower(${committee.name}) = lower(${name})`)
      .limit(1);
    return !!row;
  } catch {
    return true;
  }
}

/** Total records referencing a committee by name, across every table that does.
 * Drives the "in use — can't delete" guard. */
export async function committeeUsage(name: string): Promise<number> {
  const [p, e, t, b, i] = await Promise.all([
    db.$count(people, eq(people.committee, name)),
    db.$count(events, eq(events.committee, name)),
    db.$count(tasks, eq(tasks.committee, name)),
    db.$count(taskBoards, eq(taskBoards.committee, name)),
    db.$count(appInvite, eq(appInvite.committee, name)),
  ]);
  return p + e + t + b + i;
}
