import "server-only";

import { and, eq, isNotNull, lt, sql } from "drizzle-orm";

import { db } from "@/db";
import { appInvite, appUser, people } from "@/db/schema";

/**
 * Ensure a login (`app_user`) is linked to a roster record (`people`), and
 * return the linked person id.
 *
 * Resolution order:
 *   1. If the user already has `person_id`, use it (idempotent).
 *   2. Else match an existing, non-archived person by email (case-insensitive)
 *      and adopt it — committee members are often already on the roster.
 *   3. Else create a fresh person row.
 *
 * Either way the user's `person_id` is set so the link is permanent. A missing
 * person name is backfilled from the login name; the person's email is
 * backfilled too so later member (student id) joins have something to match.
 *
 * When a `committee` is supplied (e.g. assigned on the invite) it is written to
 * the person — the admin's deliberate invite-time choice wins over any existing
 * roster value.
 */
export async function ensurePersonForUser(user: {
  id: number;
  email: string;
  name?: string | null;
  committee?: string | null;
  roleTitle?: string | null;
}): Promise<number> {
  const [current] = await db
    .select({ personId: appUser.personId })
    .from(appUser)
    .where(eq(appUser.id, user.id))
    .limit(1);
  if (current?.personId) return current.personId;

  const email = user.email.toLowerCase().trim();
  const [match] = await db
    .select({ id: people.id, name: people.name, email: people.email })
    .from(people)
    .where(sql`lower(${people.email}) = ${email} and ${people.archived} = false`)
    .limit(1);

  let personId: number;
  if (match) {
    personId = match.id;
    // Backfill a blank name from the login so the roster isn't left empty, and
    // apply the invited committee / position when assigned.
    const patch: { name?: string; committee?: string; roleTitle?: string } = {};
    if (!match.name && user.name) patch.name = user.name;
    if (user.committee) patch.committee = user.committee;
    if (user.roleTitle) patch.roleTitle = user.roleTitle;
    if (Object.keys(patch).length) {
      await db
        .update(people)
        .set({ ...patch, updatedAt: new Date().toISOString() })
        .where(eq(people.id, personId));
    }
  } else {
    const [created] = await db
      .insert(people)
      .values({
        name: user.name ?? user.email,
        email: user.email,
        committee: user.committee ?? null,
        roleTitle: user.roleTitle ?? null,
        type: "Committee Member",
        status: "Active",
      })
      .returning({ id: people.id });
    personId = created.id;
  }

  await db
    .update(appUser)
    .set({ personId, updatedAt: new Date().toISOString() })
    .where(eq(appUser.id, user.id));

  return personId;
}

/**
 * Ensure a roster (`people`) record exists for an invited email *before* any
 * login is created, so an admin-named invitee shows up in /people immediately.
 *
 * Matches an existing, non-archived person by email (case-insensitive) and tops
 * up a blank name / the invited committee, else creates a fresh "Active"
 * Committee Member. Returns the person id.
 *
 * On acceptance `ensurePersonForUser` matches the same email and adopts this
 * row, so there is never a duplicate. An existing roster name is left untouched
 * — adopting a known member shouldn't silently rename them.
 *
 * Returns the person id and whether a fresh row was *created* (vs an existing
 * member adopted). Only created rows are recorded on the invite, so
 * revoke/expiry cleanup never archives someone who was already on the roster.
 */
export async function ensurePersonForInvite(invite: {
  email: string;
  name: string;
  committee?: string | null;
  roleTitle?: string | null;
}): Promise<{ id: number; created: boolean }> {
  const email = invite.email.toLowerCase().trim();
  const [match] = await db
    .select({ id: people.id, name: people.name })
    .from(people)
    .where(sql`lower(${people.email}) = ${email} and ${people.archived} = false`)
    .limit(1);

  if (match) {
    const patch: { name?: string; committee?: string; roleTitle?: string } = {};
    if (!match.name) patch.name = invite.name;
    if (invite.committee) patch.committee = invite.committee;
    if (invite.roleTitle) patch.roleTitle = invite.roleTitle;
    if (Object.keys(patch).length) {
      await db
        .update(people)
        .set({ ...patch, updatedAt: new Date().toISOString() })
        .where(eq(people.id, match.id));
    }
    return { id: match.id, created: false };
  }

  const [created] = await db
    .insert(people)
    .values({
      name: invite.name,
      email: invite.email,
      committee: invite.committee ?? null,
      roleTitle: invite.roleTitle ?? null,
      type: "Committee Member",
      status: "Active",
    })
    .returning({ id: people.id });
  return { id: created.id, created: true };
}

/**
 * Archive a provisional roster row that an invite created — but only if it's
 * safe: the person still exists, isn't already archived, and no login
 * (`app_user`) has adopted it. A login pointing at the row means the invitee
 * (or an admin) turned it into a real member, so we leave it alone. Archival is
 * a reversible soft delete (unarchive from /people). Returns true if archived.
 */
export async function archiveInviteSeededPerson(personId: number): Promise<boolean> {
  const [linked] = await db
    .select({ id: appUser.id })
    .from(appUser)
    .where(eq(appUser.personId, personId))
    .limit(1);
  if (linked) return false;

  const res = await db
    .update(people)
    .set({ archived: true, updatedAt: new Date().toISOString() })
    .where(and(eq(people.id, personId), eq(people.archived, false)))
    .returning({ id: people.id });
  return res.length > 0;
}

/**
 * Sweep pending invites that have expired while still holding a seeded roster
 * row: archive each unadopted person and drop the `person_id` link so the work
 * isn't repeated. Best-effort cleanup — run whenever an admin creates or revokes
 * an invite, and via scripts/cleanup-expired-invite-people.ts on a schedule.
 * Returns how many people were archived.
 */
export async function cleanupExpiredInvitePeople(): Promise<number> {
  const stale = await db
    .select({ id: appInvite.id, personId: appInvite.personId })
    .from(appInvite)
    .where(
      and(
        eq(appInvite.status, "pending"),
        lt(appInvite.expiresAt, new Date().toISOString()),
        isNotNull(appInvite.personId),
      ),
    );

  let archived = 0;
  for (const inv of stale) {
    if (inv.personId == null) continue;
    if (await archiveInviteSeededPerson(inv.personId)) archived++;
    await db.update(appInvite).set({ personId: null }).where(eq(appInvite.id, inv.id));
  }
  return archived;
}
