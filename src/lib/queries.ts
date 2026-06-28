import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  notInArray,
  or,
} from "drizzle-orm";

import { count } from "drizzle-orm";

import { db } from "@/db";
import { appSetting, events, finance, flagshipSignups, people, sponsorLeads, sponsorPackages, sponsors } from "@/db/schema";
import { todayISO } from "@/lib/format";

function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export type EventRow = typeof events.$inferSelect;
export type EventWithLead = EventRow & { leadName: string | null };
export type PersonRow = typeof people.$inferSelect;
export type SponsorRow = typeof sponsors.$inferSelect;
export type SponsorWithContact = SponsorRow & { contactName: string | null };
export type FinanceRow = typeof finance.$inferSelect;
export type FinanceWithEvent = FinanceRow & { eventName: string | null };

function withLead(rows: { e: EventRow; leadName: string | null }[]): EventWithLead[] {
  return rows.map((r) => ({ ...r.e, leadName: r.leadName }));
}

/** §4.1 — DUSA deadline within 14 days (and not Approved/Not Required), OR an
 * Idea/Planning event with no lead assigned. */
export async function getNeedsAttention(): Promise<EventWithLead[]> {
  const soon = addDaysISO(todayISO(), 14);
  const rows = await db
    .select({ e: events, leadName: people.name })
    .from(events)
    .leftJoin(people, eq(events.eventLeadId, people.id))
    .where(
      and(
        eq(events.archived, false),
        notInArray(events.status, ["Cancelled", "Completed"]),
        or(
          and(
            isNotNull(events.dusaDeadline),
            lte(events.dusaDeadline, soon),
            or(
              isNull(events.dusaSubmissionStatus),
              notInArray(events.dusaSubmissionStatus, ["Approved", "Not Required"]),
            ),
          ),
          and(inArray(events.status, ["Idea", "Planning"]), isNull(events.eventLeadId)),
        ),
      ),
    )
    .orderBy(asc(events.dusaDeadline));
  return withLead(rows);
}

/** §4.2 — start date today or later, not cancelled/completed, soonest first. */
export async function getUpcomingEvents(): Promise<EventWithLead[]> {
  const rows = await db
    .select({ e: events, leadName: people.name })
    .from(events)
    .leftJoin(people, eq(events.eventLeadId, people.id))
    .where(
      and(
        eq(events.archived, false),
        notInArray(events.status, ["Cancelled", "Completed"]),
        gte(events.startDate, todayISO()),
      ),
    )
    .orderBy(asc(events.startDate));
  return withLead(rows);
}

/** §4.4 — finance not yet settled (not Paid/Rejected), plus the summed total. */
export async function getOutstandingFinance(): Promise<{
  rows: FinanceWithEvent[];
  total: number;
}> {
  const rows = await db
    .select({ f: finance, eventName: events.name })
    .from(finance)
    .leftJoin(events, eq(finance.relatedEventId, events.id))
    .where(and(eq(finance.archived, false), notInArray(finance.status, ["Paid", "Rejected"])))
    .orderBy(asc(finance.dateRequested));
  const mapped = rows.map((r) => ({ ...r.f, eventName: r.eventName }));
  const total = mapped.reduce((acc, r) => acc + Number(r.amountAud ?? 0), 0);
  return { rows: mapped, total };
}

/** §4.5 — committee roster: everyone except General Members, active first. */
export async function getRoster(): Promise<PersonRow[]> {
  return db
    .select()
    .from(people)
    .where(and(eq(people.archived, false), notInArray(people.type, ["General Member"])))
    .orderBy(asc(people.committee), asc(people.name));
}

// --- Events section: detail + lists ---

export async function getEvents(): Promise<EventWithLead[]> {
  const rows = await db
    .select({ e: events, leadName: people.name })
    .from(events)
    .leftJoin(people, eq(events.eventLeadId, people.id))
    .where(eq(events.archived, false))
    .orderBy(asc(events.startDate));
  return withLead(rows);
}

/** §4.3 — pipeline source: active events ordered by DUSA deadline. */
export async function getDusaPipeline(): Promise<EventWithLead[]> {
  const rows = await db
    .select({ e: events, leadName: people.name })
    .from(events)
    .leftJoin(people, eq(events.eventLeadId, people.id))
    .where(
      and(eq(events.archived, false), notInArray(events.status, ["Cancelled", "Completed"])),
    )
    .orderBy(asc(events.dusaDeadline));
  return withLead(rows);
}

export async function getEventById(id: number): Promise<EventRow | null> {
  const [row] = await db.select().from(events).where(eq(events.id, id)).limit(1);
  return row ?? null;
}

export type FlagshipSignupRow = typeof flagshipSignups.$inferSelect;

/**
 * Email-funnel signups for a flagship event's teaser page (the "notify me"
 * captures + sponsor enquiries). Read-only here: the `flagship_signup` table is
 * created by the dsec-api migration, so this tolerates its absence (returns [])
 * until that ships — the event page never hard-crashes.
 */
export async function getFlagshipSignups(eventId: number): Promise<FlagshipSignupRow[]> {
  try {
    return await db
      .select()
      .from(flagshipSignups)
      .where(and(eq(flagshipSignups.eventId, eventId), eq(flagshipSignups.archived, false)))
      .orderBy(desc(flagshipSignups.createdAt));
  } catch {
    return [];
  }
}

/** Active people for relation <select>s (event lead, sponsor contact). */
export async function getPeopleOptions(): Promise<{ id: number; name: string }[]> {
  return db
    .select({ id: people.id, name: people.name })
    .from(people)
    .where(eq(people.archived, false))
    .orderBy(asc(people.name));
}

export async function getEventOptions(): Promise<{ id: number; name: string }[]> {
  return db
    .select({ id: events.id, name: events.name })
    .from(events)
    .where(eq(events.archived, false))
    .orderBy(asc(events.startDate));
}

// --- People section ---

/** Roster for the People page. `admin_only` people are hidden from non-admins;
 * pass `includeHidden` (admins) to see them too. */
export async function getAllPeople(
  opts: { includeHidden?: boolean } = {},
): Promise<PersonRow[]> {
  const conds = [eq(people.archived, false)];
  if (!opts.includeHidden) conds.push(eq(people.adminOnly, false));
  return db
    .select()
    .from(people)
    .where(and(...conds))
    .orderBy(asc(people.committee), asc(people.name));
}

export async function getPersonById(id: number): Promise<PersonRow | null> {
  const [row] = await db.select().from(people).where(eq(people.id, id)).limit(1);
  return row ?? null;
}

// --- Sponsors section ---

export async function getSponsors(): Promise<SponsorWithContact[]> {
  const rows = await db
    .select({ s: sponsors, contactName: people.name })
    .from(sponsors)
    .leftJoin(people, eq(sponsors.contactPersonId, people.id))
    .where(eq(sponsors.archived, false))
    .orderBy(asc(sponsors.organisation));
  return rows.map((r) => ({ ...r.s, contactName: r.contactName }));
}

export async function getSponsorById(id: number): Promise<SponsorRow | null> {
  const [row] = await db.select().from(sponsors).where(eq(sponsors.id, id)).limit(1);
  return row ?? null;
}

/** Active sponsors/partners for relation <select>s (e.g. an event's supporter). */
export async function getSponsorOptions(): Promise<{ id: number; name: string }[]> {
  return db
    .select({ id: sponsors.id, name: sponsors.organisation })
    .from(sponsors)
    .where(eq(sponsors.archived, false))
    .orderBy(asc(sponsors.organisation));
}

// --- Finance section ---

export async function getAllFinance(): Promise<FinanceWithEvent[]> {
  const rows = await db
    .select({ f: finance, eventName: events.name })
    .from(finance)
    .leftJoin(events, eq(finance.relatedEventId, events.id))
    .where(eq(finance.archived, false))
    .orderBy(desc(finance.dateRequested));
  return rows.map((r) => ({ ...r.f, eventName: r.eventName }));
}

export async function getFinanceById(id: number): Promise<FinanceRow | null> {
  const [row] = await db.select().from(finance).where(eq(finance.id, id)).limit(1);
  return row ?? null;
}

// --- Sponsor packages ---

export type SponsorPackageRow = typeof sponsorPackages.$inferSelect;

export async function getSponsorPackages(): Promise<SponsorPackageRow[]> {
  return db
    .select()
    .from(sponsorPackages)
    .orderBy(asc(sponsorPackages.displayOrder), asc(sponsorPackages.id));
}

export async function getSponsorPackageById(id: number): Promise<SponsorPackageRow | null> {
  const [row] = await db.select().from(sponsorPackages).where(eq(sponsorPackages.id, id)).limit(1);
  return row ?? null;
}

// --- Sponsor leads ---

export type SponsorLeadRow = typeof sponsorLeads.$inferSelect;

export async function getSponsorLeads(status?: string): Promise<SponsorLeadRow[]> {
  const q = db.select().from(sponsorLeads);
  const rows = status
    ? await q.where(eq(sponsorLeads.status, status)).orderBy(desc(sponsorLeads.createdAt))
    : await q.orderBy(desc(sponsorLeads.createdAt));
  return rows;
}

export async function getSponsorLeadById(id: number): Promise<SponsorLeadRow | null> {
  const [row] = await db.select().from(sponsorLeads).where(eq(sponsorLeads.id, id)).limit(1);
  return row ?? null;
}

export async function getNewLeadCount(): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(sponsorLeads)
    .where(eq(sponsorLeads.status, "new"));
  return row?.c ?? 0;
}

// --- Site settings (key/value) ---

/**
 * All site settings as a flat `{ key: value }` map. Degrades to `{}` if the
 * `app_setting` table hasn't been created yet (run scripts/setup-settings.ts)
 * so the Settings page never hard-crashes on a fresh install.
 */
export async function getSiteSettings(): Promise<Record<string, string>> {
  try {
    const rows = await db.select().from(appSetting);
    const out: Record<string, string> = {};
    for (const r of rows) if (r.value != null) out[r.key] = r.value;
    return out;
  } catch {
    return {};
  }
}
