"use server";

import { revalidatePath } from "next/cache";
import { count, eq } from "drizzle-orm";

import { db } from "@/db";
import { appUser, people } from "@/db/schema";
import {
  documents,
  events,
  eventSpeakers,
  projects,
  sponsorContacts,
  sponsors,
  tasks,
} from "@/db/workspace-schema";
import { requireWrite } from "@/lib/dal";
import { bool, int, str } from "@/lib/form-data";
import { isAdmin } from "@/lib/rbac";
import { revalidateWebsite } from "@/lib/revalidate-website";
import { archiveToken, createToken, snapshotForDelete, snapshotForUpdate } from "@/lib/undo";
import type { ActionResult } from "@/lib/undo-types";

export type FormState = ActionResult;

/** `canHide` (admin only) decides whether the admin-only visibility flag is
 * read from the form. Non-admins never submit it, so we leave the column
 * untouched for them — preventing an edit from silently un-hiding a person. */
function parsePerson(fd: FormData, opts: { canHide: boolean }) {
  const base = {
    name: str(fd, "name") ?? "",
    type: str(fd, "type"),
    committee: str(fd, "committee"),
    roleTitle: str(fd, "role_title"),
    email: str(fd, "email"),
    status: str(fd, "status"),
    studentId: str(fd, "student_id"),
    discord: str(fd, "discord"),
    instagram: str(fd, "instagram"),
    github: str(fd, "github"),
    linkedin: str(fd, "linkedin"),
    website: str(fd, "website"),
    notes: str(fd, "notes"),
    bio: str(fd, "bio"),
    showOnWebsite: bool(fd, "show_on_website"),
    displayOrder: int(fd, "display_order") ?? 0,
  };
  return opts.canHide ? { ...base, adminOnly: bool(fd, "admin_only") } : base;
}

async function revalidatePeople() {
  revalidatePath("/people");
  revalidatePath("/");
  // The public roster (/website/team) is tagged "team".
  await revalidateWebsite("team");
}

export async function createPerson(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requireWrite("people");
  const values = parsePerson(fd, { canHide: isAdmin(me.modules) });
  if (!values.name) return { error: "Name is required." };
  const [row] = await db.insert(people).values(values).returning({ id: people.id });
  await revalidatePeople();
  return { ok: true, message: "Person created", undo: createToken("person", row?.id) };
}

export async function updatePerson(
  id: number,
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const me = await requireWrite("people");
  const values = parsePerson(fd, { canHide: isAdmin(me.modules) });
  if (!values.name) return { error: "Name is required." };
  const undo = await snapshotForUpdate("person", id);
  await db
    .update(people)
    .set({ ...values, updatedAt: new Date().toISOString() })
    .where(eq(people.id, id));
  await revalidatePeople();
  return { ok: true, message: "Person updated", undo };
}

export async function archivePerson(id: number): Promise<FormState> {
  await requireWrite("people");
  await db
    .update(people)
    .set({ archived: true, updatedAt: new Date().toISOString() })
    .where(eq(people.id, id));
  await revalidatePeople();
  return {
    ok: true,
    message: "Person archived",
    undo: archiveToken("person", id),
  };
}

/** A set of rows that reference a person through a blocking foreign key. */
type PersonLink = { label: string; labelPlural: string; names: string[]; total: number };

/** Postgres foreign-key violation — a referenced row still exists (SQLSTATE 23503). */
function isFkViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "23503";
}

/** Collapse one or more name-row lists into a unique, non-empty name list. */
function dedupeNames(...lists: { name: string | null }[][]): string[] {
  const seen = new Set<string>();
  for (const row of lists.flat()) if (row.name) seen.add(row.name);
  return [...seen];
}

/**
 * Enumerate every record that points at this person through a blocking FK, so a
 * delete can fail with a clear "still linked to…" message instead of throwing a
 * raw 23503 that crashes the edit page. Archived rows are included on purpose:
 * the FK constraints in Neon ignore the `archived` flag, so an archived event
 * still pins its lead. `committee.lead_person_id` is omitted — it is ON DELETE
 * SET NULL, so it never blocks a delete.
 */
async function findPersonLinks(id: number): Promise<PersonLink[]> {
  const [leadEvents, speakerEvents, leadProjects, contactSponsors, sponsorContactRows, taskRows, docRows, loginRows] =
    await Promise.all([
      db.select({ name: events.name }).from(events).where(eq(events.eventLeadId, id)),
      db
        .select({ name: events.name })
        .from(eventSpeakers)
        .innerJoin(events, eq(eventSpeakers.eventId, events.id))
        .where(eq(eventSpeakers.personId, id)),
      db.select({ name: projects.name }).from(projects).where(eq(projects.leadId, id)),
      db.select({ name: sponsors.organisation }).from(sponsors).where(eq(sponsors.contactPersonId, id)),
      db
        .select({ name: sponsors.organisation })
        .from(sponsorContacts)
        .innerJoin(sponsors, eq(sponsorContacts.sponsorId, sponsors.id))
        .where(eq(sponsorContacts.personId, id)),
      db.select({ c: count() }).from(tasks).where(eq(tasks.assigneeId, id)),
      db.select({ c: count() }).from(documents).where(eq(documents.assigneeId, id)),
      db.select({ c: count() }).from(appUser).where(eq(appUser.personId, id)),
    ]);

  const eventNames = dedupeNames(leadEvents, speakerEvents);
  const projectNames = dedupeNames(leadProjects);
  const sponsorNames = dedupeNames(contactSponsors, sponsorContactRows);

  const groups: PersonLink[] = [
    { label: "event", labelPlural: "events", names: eventNames, total: eventNames.length },
    { label: "project", labelPlural: "projects", names: projectNames, total: projectNames.length },
    { label: "sponsor", labelPlural: "sponsors", names: sponsorNames, total: sponsorNames.length },
    { label: "assigned task", labelPlural: "assigned tasks", names: [], total: taskRows[0]?.c ?? 0 },
    { label: "document", labelPlural: "documents", names: [], total: docRows[0]?.c ?? 0 },
    { label: "login account", labelPlural: "login accounts", names: [], total: loginRows[0]?.c ?? 0 },
  ];
  return groups.filter((g) => g.total > 0);
}

/** "2 events (AI Night, Hackathon, +1 more)" or "3 assigned tasks". */
function describeLink(g: PersonLink): string {
  const head = `${g.total} ${g.total === 1 ? g.label : g.labelPlural}`;
  if (g.names.length === 0) return head;
  const shown = g.names.slice(0, 3);
  const extra = g.total - shown.length;
  return `${head} (${shown.join(", ")}${extra > 0 ? `, +${extra} more` : ""})`;
}

/** Natural-language list join: ["a","b","c"] → "a, b, and c". */
function joinList(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

export async function deletePerson(id: number): Promise<FormState> {
  await requireWrite("people");

  // A hard delete fails at the DB if anything still references this person. Find
  // those links up front so we can tell the user exactly what to unlink, instead
  // of letting the foreign-key violation bubble up and crash the page.
  const links = await findPersonLinks(id);
  if (links.length > 0) {
    const [person] = await db.select({ name: people.name }).from(people).where(eq(people.id, id));
    const who = person?.name ?? "this person";
    return {
      error: `Can't delete ${who} — still linked to ${joinList(
        links.map(describeLink),
      )}. Reassign or remove those links first, or archive ${person ? "them" : "this person"} instead.`,
    };
  }

  const undo = await snapshotForDelete("person", id);
  try {
    await db.delete(people).where(eq(people.id, id));
  } catch (e) {
    // Safety net for a link created between the check above and now (or any FK we
    // didn't enumerate): surface it as a toast rather than an unhandled crash.
    if (isFkViolation(e)) {
      return {
        error:
          "Can't delete this person — they're still linked to other records. Reassign or remove those links first, or archive them instead.",
      };
    }
    throw e;
  }
  await revalidatePeople();
  return { ok: true, message: "Person deleted", undo };
}
