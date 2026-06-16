import "server-only";

import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { appUser, people } from "@/db/schema";

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
    // apply the invited committee when one was assigned.
    const patch: { name?: string; committee?: string } = {};
    if (!match.name && user.name) patch.name = user.name;
    if (user.committee) patch.committee = user.committee;
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
