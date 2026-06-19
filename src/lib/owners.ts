import "server-only";

import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { eventOwners, people, projectOwners, taskOwners } from "@/db/workspace-schema";

/**
 * Co-owner helpers for tasks / events / projects.
 *
 * Each entity keeps ONE primary owner on its own row (task.assigneeId,
 * events.eventLeadId, project.leadId); these join tables hold the additional
 * owners. The setters do a full replace (the form submits the complete co-owner
 * set), de-dupe, and drop the primary so it's never stored twice. Getters return
 * `{ id, name }` so they double as the form's pre-selected ids AND the display
 * list on detail pages.
 */

export type OwnerPerson = { id: number; name: string };

function clean(personIds: number[], primary: number | null | undefined): number[] {
  return [...new Set(personIds.filter((p) => Number.isFinite(p) && p > 0 && p !== primary))];
}

// --- tasks -----------------------------------------------------------------

export async function getTaskOwners(taskId: number): Promise<OwnerPerson[]> {
  return db
    .select({ id: people.id, name: people.name })
    .from(taskOwners)
    .innerJoin(people, eq(taskOwners.personId, people.id))
    .where(eq(taskOwners.taskId, taskId))
    .orderBy(asc(taskOwners.id));
}

export async function getTaskOwnerIds(taskId: number): Promise<number[]> {
  const rows = await db
    .select({ id: taskOwners.personId })
    .from(taskOwners)
    .where(eq(taskOwners.taskId, taskId))
    .orderBy(asc(taskOwners.id));
  return rows.map((r) => r.id);
}

export async function setTaskOwners(taskId: number, personIds: number[], primary: number | null) {
  const ids = clean(personIds, primary);
  await db.delete(taskOwners).where(eq(taskOwners.taskId, taskId));
  if (ids.length) await db.insert(taskOwners).values(ids.map((personId) => ({ taskId, personId })));
}

// --- events ----------------------------------------------------------------

export async function getEventOwners(eventId: number): Promise<OwnerPerson[]> {
  return db
    .select({ id: people.id, name: people.name })
    .from(eventOwners)
    .innerJoin(people, eq(eventOwners.personId, people.id))
    .where(eq(eventOwners.eventId, eventId))
    .orderBy(asc(eventOwners.id));
}

export async function setEventOwners(eventId: number, personIds: number[], primary: number | null) {
  const ids = clean(personIds, primary);
  await db.delete(eventOwners).where(eq(eventOwners.eventId, eventId));
  if (ids.length) await db.insert(eventOwners).values(ids.map((personId) => ({ eventId, personId })));
}

// --- projects --------------------------------------------------------------

export async function getProjectOwners(projectId: number): Promise<OwnerPerson[]> {
  return db
    .select({ id: people.id, name: people.name })
    .from(projectOwners)
    .innerJoin(people, eq(projectOwners.personId, people.id))
    .where(eq(projectOwners.projectId, projectId))
    .orderBy(asc(projectOwners.id));
}

export async function setProjectOwners(projectId: number, personIds: number[], primary: number | null) {
  const ids = clean(personIds, primary);
  await db.delete(projectOwners).where(eq(projectOwners.projectId, projectId));
  if (ids.length) await db.insert(projectOwners).values(ids.map((personId) => ({ projectId, personId })));
}

/** Parse the repeated `co_owner_ids` hidden inputs the PeopleMultiSelect emits. */
export function coOwnerIdsOf(fd: FormData, field = "co_owner_ids"): number[] {
  return fd
    .getAll(field)
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n > 0);
}
