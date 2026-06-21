import "server-only";

import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, lte, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { committee } from "@/db/schema";
import {
  attachments,
  documents,
  eventConnections,
  eventPartners,
  eventSpeakers,
  eventSponsors,
  events,
  financeReports,
  financeTransactions,
  mediaAssets,
  meetings,
  memberReports,
  members,
  partners,
  people,
  projects,
  sponsorContacts,
  sponsors,
  taskBoards,
  taskOwners,
  tasks,
  projectOwners,
  usageEvents,
} from "@/db/workspace-schema";
import { todayISO } from "@/lib/format";
import { DEFAULT_BOARD_COLUMNS } from "@/lib/workspace-options";
import type { CommitteeScope } from "@/lib/scope";

const num = (v: unknown): number => Number(v ?? 0) || 0;

/** WHERE condition restricting a committee-scoped column (meeting/document) to
 * what the viewer may see: "all" → no restriction; otherwise own committee +
 * club-wide (null). Returns undefined when no restriction applies. */
function committeeCond(
  column: typeof meetings.committee | typeof documents.committee,
  scope: CommitteeScope,
) {
  if (scope.all) return undefined;
  return scope.committee ? or(isNull(column), eq(column, scope.committee)) : isNull(column);
}

// ===========================================================================
// Members
// ===========================================================================

export async function getMemberStats() {
  const [c] = await db
    .select({
      current: sql<number>`count(*) filter (where ${members.isCurrent})`,
      dusa: sql<number>`count(*) filter (where ${members.isCurrent} and ${members.dusaMember})`,
      total: count(),
    })
    .from(members);
  const trend = await db
    .select()
    .from(memberReports)
    .orderBy(desc(memberReports.reportDate))
    .limit(16);
  return {
    current: num(c?.current),
    dusa: num(c?.dusa),
    nonDusa: num(c?.current) - num(c?.dusa),
    totalSeen: num(c?.total),
    trend: trend.reverse(), // oldest -> newest for charts
  };
}

export async function getMembers(opts: { search?: string; dusaOnly?: boolean; currentOnly?: boolean } = {}) {
  const conds = [];
  if (opts.currentOnly !== false) conds.push(eq(members.isCurrent, true));
  if (opts.dusaOnly) conds.push(eq(members.dusaMember, true));
  if (opts.search) {
    const q = `%${opts.search}%`;
    conds.push(or(ilike(members.fullName, q), ilike(members.email, q), ilike(members.studentId, q)));
  }
  return db
    .select()
    .from(members)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(members.fullName))
    .limit(500);
}

export type MemberRow = typeof members.$inferSelect;

/** Live DUSA membership row for a student id, or null. Used to surface a
 * committee person's club-membership status from their linked student id. */
export async function getMemberByStudentId(
  studentId: string | null | undefined,
): Promise<MemberRow | null> {
  const id = studentId?.trim();
  if (!id) return null;
  const [row] = await db.select().from(members).where(eq(members.studentId, id)).limit(1);
  return row ?? null;
}

export async function getFacultyBreakdown() {
  const rows = await db
    .select({ faculty: members.faculty, c: count() })
    .from(members)
    .where(eq(members.isCurrent, true))
    .groupBy(members.faculty)
    .orderBy(desc(count()));
  return rows.map((r) => ({ label: r.faculty ?? "Unknown", value: num(r.c) }));
}

// ===========================================================================
// Finance
// ===========================================================================

export async function getFinanceSummary() {
  const [report] = await db
    .select()
    .from(financeReports)
    .where(eq(financeReports.isCurrent, true))
    .limit(1);
  const [budgets] = await db
    .select({
      budget: sql<number>`coalesce(sum(${events.budgetAud}), 0)`,
      grant: sql<number>`coalesce(sum(${events.grantAud}), 0)`,
    })
    .from(events)
    .where(eq(events.archived, false));
  return {
    report: report ?? null,
    totalBudget: num(budgets?.budget),
    totalGrant: num(budgets?.grant),
  };
}

export async function getCurrentTransactions() {
  const [report] = await db
    .select({ id: financeReports.id })
    .from(financeReports)
    .where(eq(financeReports.isCurrent, true))
    .limit(1);
  if (!report) return [];
  return db
    .select()
    .from(financeTransactions)
    .where(eq(financeTransactions.reportId, report.id))
    .orderBy(desc(financeTransactions.postingDate));
}

export async function getExpenseBreakdown() {
  const [report] = await db
    .select({ id: financeReports.id })
    .from(financeReports)
    .where(eq(financeReports.isCurrent, true))
    .limit(1);
  if (!report) return [];
  const rows = await db
    .select({
      label: financeTransactions.glAccountName,
      total: sql<number>`coalesce(sum(${financeTransactions.amountAbs}), 0)`,
    })
    .from(financeTransactions)
    .where(and(eq(financeTransactions.reportId, report.id), eq(financeTransactions.kind, "expense")))
    .groupBy(financeTransactions.glAccountName)
    .orderBy(desc(sql`sum(${financeTransactions.amountAbs})`))
    .limit(6);
  return rows.map((r) => ({ label: r.label ?? "Other", value: num(r.total) }));
}

export async function getEventBudgets() {
  return db
    .select({ id: events.id, name: events.name, budgetAud: events.budgetAud, grantAud: events.grantAud, status: events.status })
    .from(events)
    .where(and(eq(events.archived, false), sql`${events.budgetAud} is not null`))
    .orderBy(desc(events.budgetAud))
    .limit(20);
}

// ===========================================================================
// Tasks
// ===========================================================================

export async function getBoards() {
  return db.select().from(taskBoards).where(eq(taskBoards.archived, false)).orderBy(asc(taskBoards.name));
}

export type TaskCard = {
  id: number;
  title: string;
  description: string | null;
  status: string;
  position: number;
  priority: string | null;
  dueDate: string | null;
  assigneeId: number | null;
  committee: string | null;
  completedAt: string | null;
  assigneeName: string | null;
};

type BoardRow = Awaited<ReturnType<typeof getBoards>>[number];

// Shared select projection for a task card (matches TaskCard).
const taskCardFields = {
  id: tasks.id, title: tasks.title, description: tasks.description, status: tasks.status,
  position: tasks.position, priority: tasks.priority, dueDate: tasks.dueDate,
  assigneeId: tasks.assigneeId, committee: tasks.committee, completedAt: tasks.completedAt,
  assigneeName: people.name,
};

// Bucket tasks into the given columns; any task whose status isn't a known
// column falls into the first column so nothing is hidden.
function toColumns(rows: TaskCard[], cols: string[]) {
  const columns = cols.map((name) => ({ name, tasks: rows.filter((t) => t.status === name) }));
  const known = new Set(cols);
  const orphans = rows.filter((t) => !known.has(t.status));
  if (orphans.length && columns[0]) columns[0].tasks.push(...orphans);
  return columns;
}

export async function getBoardWithTasks(boardId?: number): Promise<{
  board: BoardRow | null;
  boards: BoardRow[];
  columns: { name: string; tasks: TaskCard[] }[];
}> {
  const boards = await getBoards();
  const board = boardId ? boards.find((b) => b.id === boardId) ?? boards[0] : boards[0];
  if (!board) return { board: null, boards, columns: [] };
  const rows: TaskCard[] = await db
    .select(taskCardFields)
    .from(tasks)
    .leftJoin(people, eq(tasks.assigneeId, people.id))
    .where(and(eq(tasks.boardId, board.id), eq(tasks.archived, false)))
    .orderBy(asc(tasks.position), asc(tasks.id));
  const cols = (board.columns ?? [...DEFAULT_BOARD_COLUMNS]) as string[];
  return { board, boards, columns: toColumns(rows, cols) };
}

/**
 * The Inbox: tasks not assigned to any board (boardId IS NULL). Without this,
 * a task created with no board would be invisible everywhere. Shown with the
 * default columns so it behaves like a board.
 */
export async function getInboxColumns(): Promise<{
  columns: { name: string; tasks: TaskCard[] }[];
  count: number;
}> {
  const rows: TaskCard[] = await db
    .select(taskCardFields)
    .from(tasks)
    .leftJoin(people, eq(tasks.assigneeId, people.id))
    .where(and(isNull(tasks.boardId), eq(tasks.archived, false)))
    .orderBy(asc(tasks.position), asc(tasks.id));
  return { columns: toColumns(rows, [...DEFAULT_BOARD_COLUMNS]), count: rows.length };
}

export async function getTaskStats() {
  const today = todayISO();
  const [s] = await db
    .select({
      open: sql<number>`count(*) filter (where ${tasks.completedAt} is null)`,
      done: sql<number>`count(*) filter (where ${tasks.completedAt} is not null)`,
      overdue: sql<number>`count(*) filter (where ${tasks.completedAt} is null and ${tasks.dueDate} is not null and ${tasks.dueDate} < ${today})`,
      total: count(),
    })
    .from(tasks)
    .where(eq(tasks.archived, false));
  return { open: num(s?.open), done: num(s?.done), overdue: num(s?.overdue), total: num(s?.total) };
}

export async function getTasksDueSoon(days = 14, limit = 12) {
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + days);
  const horizonISO = horizon.toISOString().slice(0, 10);
  return db
    .select({
      id: tasks.id, title: tasks.title, status: tasks.status, priority: tasks.priority,
      dueDate: tasks.dueDate, committee: tasks.committee, assigneeName: people.name,
    })
    .from(tasks)
    .leftJoin(people, eq(tasks.assigneeId, people.id))
    .where(
      and(
        eq(tasks.archived, false),
        sql`${tasks.completedAt} is null`,
        sql`${tasks.dueDate} is not null`,
        lte(tasks.dueDate, horizonISO),
      ),
    )
    .orderBy(asc(tasks.dueDate))
    .limit(limit);
}

/** Open tasks owned by a person — as the primary assignee OR a co-owner —
 * soonest-due first (My Work). */
export async function getMyOpenTasks(assigneeId: number, limit = 14) {
  const coOwned = db
    .select({ id: taskOwners.taskId })
    .from(taskOwners)
    .where(eq(taskOwners.personId, assigneeId));
  return db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      priority: tasks.priority,
      dueDate: tasks.dueDate,
      committee: tasks.committee,
    })
    .from(tasks)
    .where(
      and(
        eq(tasks.archived, false),
        isNull(tasks.completedAt),
        or(eq(tasks.assigneeId, assigneeId), inArray(tasks.id, coOwned)),
      ),
    )
    .orderBy(sql`${tasks.dueDate} is null`, asc(tasks.dueDate), asc(tasks.id))
    .limit(limit);
}

export type CommitteeHealthRow = {
  name: string;
  color: string | null;
  lead: string | null;
  members: number;
  open: number;
  overdue: number;
};

/** Per-committee health for the leadership dashboard: open/overdue task counts,
 * lead, and member count. Gate the CALLER on tasks access (see dashboard). */
export async function getCommitteeHealth(): Promise<CommitteeHealthRow[]> {
  const today = todayISO();
  const [taskCounts, memberCounts, committees] = await Promise.all([
    db
      .select({
        committee: tasks.committee,
        open: sql<number>`count(*) filter (where ${tasks.completedAt} is null)`,
        overdue: sql<number>`count(*) filter (where ${tasks.completedAt} is null and ${tasks.dueDate} is not null and ${tasks.dueDate} < ${today})`,
      })
      .from(tasks)
      .where(eq(tasks.archived, false))
      .groupBy(tasks.committee),
    db
      .select({ committee: people.committee, n: count() })
      .from(people)
      .where(eq(people.archived, false))
      .groupBy(people.committee),
    db
      .select({
        name: committee.name,
        color: committee.color,
        leadPersonId: committee.leadPersonId,
        sortOrder: committee.sortOrder,
      })
      .from(committee)
      .where(eq(committee.isActive, true))
      .orderBy(asc(committee.sortOrder), asc(committee.name)),
  ]);

  const tByName = new Map(taskCounts.filter((t) => t.committee).map((t) => [t.committee as string, t]));
  const mByName = new Map(memberCounts.filter((m) => m.committee).map((m) => [m.committee as string, num(m.n)]));

  const leadIds = committees.map((c) => c.leadPersonId).filter((x): x is number => x != null);
  const leads = leadIds.length
    ? await db.select({ id: people.id, name: people.name }).from(people).where(inArray(people.id, leadIds))
    : [];
  const leadName = new Map(leads.map((l) => [l.id, l.name]));

  return committees.map((c) => {
    const t = tByName.get(c.name);
    return {
      name: c.name,
      color: c.color,
      lead: c.leadPersonId != null ? leadName.get(c.leadPersonId) ?? null : null,
      members: mByName.get(c.name) ?? 0,
      open: num(t?.open),
      overdue: num(t?.overdue),
    };
  });
}

// ===========================================================================
// Projects
// ===========================================================================

export async function getProjects(opts: { publicOnly?: boolean; leadId?: number } = {}) {
  const conds = [eq(projects.archived, false)];
  if (opts.publicOnly) conds.push(eq(projects.isPublic, true));
  // Scoped (non-module) access: a lead sees the projects they lead OR co-own.
  if (opts.leadId != null) {
    const coLed = db
      .select({ id: projectOwners.projectId })
      .from(projectOwners)
      .where(eq(projectOwners.personId, opts.leadId));
    const scope = or(eq(projects.leadId, opts.leadId), inArray(projects.id, coLed));
    if (scope) conds.push(scope);
  }
  return db
    .select({
      id: projects.id, name: projects.name, slug: projects.slug, summary: projects.summary,
      status: projects.status, category: projects.category, techTags: projects.techTags,
      featured: projects.featured, isPublic: projects.isPublic, repoUrl: projects.repoUrl,
      demoUrl: projects.demoUrl, leadName: people.name,
    })
    .from(projects)
    .leftJoin(people, eq(projects.leadId, people.id))
    .where(and(...conds))
    .orderBy(desc(projects.featured), desc(projects.updatedAt));
}

export async function getProjectStats() {
  const [s] = await db
    .select({
      total: sql<number>`count(*) filter (where not ${projects.archived})`,
      public: sql<number>`count(*) filter (where ${projects.isPublic} and not ${projects.archived})`,
      shipped: sql<number>`count(*) filter (where ${projects.status} in ('Completed','Showcased') and not ${projects.archived})`,
    })
    .from(projects);
  return { total: num(s?.total), public: num(s?.public), shipped: num(s?.shipped) };
}

// ===========================================================================
// Events
// ===========================================================================

export async function getUpcomingEvents(limit = 8) {
  const today = todayISO();
  return db
    .select({
      id: events.id, name: events.name, startDate: events.startDate, status: events.status,
      type: events.type, venue: events.venue, committee: events.committee, leadName: people.name,
    })
    .from(events)
    .leftJoin(people, eq(events.eventLeadId, people.id))
    .where(and(eq(events.archived, false), gte(events.startDate, today)))
    .orderBy(asc(events.startDate))
    .limit(limit);
}

/** Speakers attached to an event, each with their (optional) headshot photos.
 * Links resolve the person's name when the row has no free-text name. */
export type EventSpeakerRow = Awaited<ReturnType<typeof getEventSpeakers>>[number];

export async function getEventSpeakers(eventId: number) {
  const rows = await db
    .select({
      id: eventSpeakers.id,
      personId: eventSpeakers.personId,
      name: eventSpeakers.name,
      title: eventSpeakers.title,
      bio: eventSpeakers.bio,
      sortOrder: eventSpeakers.sortOrder,
      personName: people.name,
    })
    .from(eventSpeakers)
    .leftJoin(people, eq(eventSpeakers.personId, people.id))
    .where(and(eq(eventSpeakers.eventId, eventId), eq(eventSpeakers.archived, false)))
    .orderBy(asc(eventSpeakers.sortOrder), asc(eventSpeakers.id));
  if (!rows.length) return [];
  // Batch-load every speaker's own photos in one query, then group by speaker id.
  const photos = await db
    .select()
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.archived, false),
        eq(mediaAssets.entityType, "speaker"),
        inArray(mediaAssets.entityId, rows.map((r) => r.id)),
      ),
    )
    .orderBy(asc(mediaAssets.sortOrder), asc(mediaAssets.id));
  const byId = new Map<number, typeof photos>();
  for (const p of photos) {
    const list = byId.get(p.entityId) ?? [];
    list.push(p);
    byId.set(p.entityId, list);
  }
  // For linked speakers with no own photo, fall back to the person's profile
  // photo (entity_type="person") so linking a directory person reuses their
  // headshot automatically; a speaker-specific upload still overrides it.
  const inheritIds = [
    ...new Set(
      rows
        .filter((r) => r.personId && !byId.get(r.id)?.length)
        .map((r) => r.personId as number),
    ),
  ];
  const personPhotos = inheritIds.length
    ? await db
        .select()
        .from(mediaAssets)
        .where(
          and(
            eq(mediaAssets.archived, false),
            eq(mediaAssets.entityType, "person"),
            inArray(mediaAssets.entityId, inheritIds),
          ),
        )
        .orderBy(asc(mediaAssets.sortOrder), asc(mediaAssets.id))
    : [];
  const personPhotoById = new Map<number, string>();
  for (const p of personPhotos) {
    if (!personPhotoById.has(p.entityId)) personPhotoById.set(p.entityId, p.webpUrl);
  }
  return rows.map((r) => {
    const own = byId.get(r.id) ?? [];
    return {
      ...r,
      displayName: r.name || r.personName || "Speaker",
      photos: own,
      inheritedPhoto:
        own.length === 0 && r.personId ? personPhotoById.get(r.personId) ?? null : null,
    };
  });
}

/** Sponsors linked to an event (for the logo wall), each with its logo. */
export type EventSponsorRow = Awaited<ReturnType<typeof getEventSponsors>>[number];

export async function getEventSponsors(eventId: number) {
  const rows = await db
    .select({
      id: eventSponsors.id,
      sponsorId: eventSponsors.sponsorId,
      tier: eventSponsors.tier,
      sortOrder: eventSponsors.sortOrder,
      organisation: sponsors.organisation,
      website: sponsors.website,
    })
    .from(eventSponsors)
    .innerJoin(sponsors, eq(eventSponsors.sponsorId, sponsors.id))
    .where(
      and(
        eq(eventSponsors.eventId, eventId),
        eq(eventSponsors.archived, false),
        eq(sponsors.archived, false),
      ),
    )
    .orderBy(asc(eventSponsors.sortOrder), asc(eventSponsors.id));
  if (!rows.length) return [];
  const logos = await db
    .select()
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.archived, false),
        eq(mediaAssets.entityType, "sponsor"),
        eq(mediaAssets.role, "logo"),
        inArray(mediaAssets.entityId, rows.map((r) => r.sponsorId)),
      ),
    )
    .orderBy(asc(mediaAssets.sortOrder), asc(mediaAssets.id));
  const byId = new Map<number, (typeof logos)[number]>();
  for (const l of logos) if (!byId.has(l.entityId)) byId.set(l.entityId, l);
  return rows.map((r) => ({ ...r, logo: byId.get(r.sponsorId) ?? null }));
}

/** Partners (collaborator clubs) linked to an event, each with its logo.
 * Mirrors getEventSponsors — the logo lives on the partner and is reused. */
export type EventPartnerRow = Awaited<ReturnType<typeof getEventPartners>>[number];

export async function getEventPartners(eventId: number) {
  const rows = await db
    .select({
      id: eventPartners.id,
      partnerId: eventPartners.partnerId,
      role: eventPartners.role,
      sortOrder: eventPartners.sortOrder,
      name: partners.name,
      website: partners.website,
    })
    .from(eventPartners)
    .innerJoin(partners, eq(eventPartners.partnerId, partners.id))
    .where(
      and(
        eq(eventPartners.eventId, eventId),
        eq(eventPartners.archived, false),
        eq(partners.archived, false),
      ),
    )
    .orderBy(asc(eventPartners.sortOrder), asc(eventPartners.id));
  if (!rows.length) return [];
  const logos = await db
    .select()
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.archived, false),
        eq(mediaAssets.entityType, "partner"),
        eq(mediaAssets.role, "logo"),
        inArray(mediaAssets.entityId, rows.map((r) => r.partnerId)),
      ),
    )
    .orderBy(asc(mediaAssets.sortOrder), asc(mediaAssets.id));
  const byId = new Map<number, (typeof logos)[number]>();
  for (const l of logos) if (!byId.has(l.entityId)) byId.set(l.entityId, l);
  return rows.map((r) => ({ ...r, logo: byId.get(r.partnerId) ?? null }));
}

/** Every event-to-event link (both directions implied — the relation is
 * symmetric). Used by the /events "Related" view to cluster connected events.
 * Edges to archived events are harmless: the clusterer only unions ids that are
 * in the visible event set, so dangling endpoints are ignored. */
export async function getAllEventConnections() {
  return db
    .select({
      eventAId: eventConnections.eventAId,
      eventBId: eventConnections.eventBId,
      label: eventConnections.label,
    })
    .from(eventConnections)
    .where(eq(eventConnections.archived, false));
}

/** Other events connected to this one (a symmetric, visual-only relation). The
 * link is order-independent, so the "other" side is whichever id isn't `eventId`.
 * Archived events are dropped so the list never shows a dangling connection. */
export type EventConnectionRow = Awaited<ReturnType<typeof getEventConnections>>[number];

export async function getEventConnections(eventId: number) {
  const links = await db
    .select({
      id: eventConnections.id,
      eventAId: eventConnections.eventAId,
      eventBId: eventConnections.eventBId,
      label: eventConnections.label,
    })
    .from(eventConnections)
    .where(
      and(
        eq(eventConnections.archived, false),
        or(eq(eventConnections.eventAId, eventId), eq(eventConnections.eventBId, eventId)),
      ),
    )
    .orderBy(asc(eventConnections.id));
  if (!links.length) return [];
  const otherIds = links.map((l) => (l.eventAId === eventId ? l.eventBId : l.eventAId));
  const others = await db
    .select({
      id: events.id,
      name: events.name,
      status: events.status,
      startDate: events.startDate,
      isPublic: events.isPublic,
    })
    .from(events)
    .where(and(eq(events.archived, false), inArray(events.id, otherIds)));
  const byId = new Map(others.map((e) => [e.id, e]));
  return links
    .map((l) => {
      const otherId = l.eventAId === eventId ? l.eventBId : l.eventAId;
      const other = byId.get(otherId);
      if (!other) return null; // other event archived/missing
      return {
        id: l.id,
        label: l.label,
        otherId,
        name: other.name,
        status: other.status,
        startDate: other.startDate,
        isPublic: other.isPublic,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? ""));
}

// ===========================================================================
// Partners (collaborator clubs) — lightweight, no pipeline
// ===========================================================================

export type PartnerRow = typeof partners.$inferSelect;

/** All partners with their logo, for the Partners list page. */
export type PartnerWithLogo = PartnerRow & { logo: string | null };

export async function getPartners(): Promise<PartnerWithLogo[]> {
  const rows = await db
    .select()
    .from(partners)
    .where(eq(partners.archived, false))
    .orderBy(asc(partners.name));
  if (!rows.length) return [];
  const logos = await db
    .select()
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.archived, false),
        eq(mediaAssets.entityType, "partner"),
        eq(mediaAssets.role, "logo"),
        inArray(mediaAssets.entityId, rows.map((r) => r.id)),
      ),
    )
    .orderBy(asc(mediaAssets.sortOrder), asc(mediaAssets.id));
  const byId = new Map<number, string>();
  for (const l of logos) if (!byId.has(l.entityId)) byId.set(l.entityId, l.webpUrl);
  return rows.map((r) => ({ ...r, logo: byId.get(r.id) ?? null }));
}

export async function getPartnerById(id: number): Promise<PartnerRow | null> {
  const [row] = await db.select().from(partners).where(eq(partners.id, id)).limit(1);
  return row ?? null;
}

/** Active partners for the "add to event" <select>. */
export async function getPartnerOptions(): Promise<Option[]> {
  return db
    .select({ id: partners.id, name: partners.name })
    .from(partners)
    .where(eq(partners.archived, false))
    .orderBy(asc(partners.name));
}

/** Events this partner is linked to (the other side of the m2m), with the
 * optional per-event role. Shown on the partner detail page. */
export type PartnerEventRow = Awaited<ReturnType<typeof getPartnerEvents>>[number];

export async function getPartnerEvents(partnerId: number) {
  return db
    .select({
      id: events.id,
      name: events.name,
      status: events.status,
      startDate: events.startDate,
      role: eventPartners.role,
    })
    .from(eventPartners)
    .innerJoin(events, eq(eventPartners.eventId, events.id))
    .where(
      and(
        eq(eventPartners.partnerId, partnerId),
        eq(eventPartners.archived, false),
        eq(events.archived, false),
      ),
    )
    .orderBy(desc(events.startDate));
}

// ===========================================================================
// Meetings + documents
// ===========================================================================

export async function getMeetings(scope: CommitteeScope, limit = 50) {
  const conds = [eq(meetings.archived, false)];
  const cc = committeeCond(meetings.committee, scope);
  if (cc) conds.push(cc);
  return db
    .select()
    .from(meetings)
    .where(and(...conds))
    .orderBy(desc(meetings.meetingDate))
    .limit(limit);
}

/** The next scheduled meetings (today onward), committee-scoped, soonest first.
 * Powers the dashboard "Upcoming meetings" section. */
export async function getUpcomingMeetings(scope: CommitteeScope, limit = 6) {
  const today = todayISO();
  const conds = [eq(meetings.archived, false), gte(meetings.meetingDate, today)];
  const cc = committeeCond(meetings.committee, scope);
  if (cc) conds.push(cc);
  return db
    .select({
      id: meetings.id, title: meetings.title, type: meetings.type,
      committee: meetings.committee, meetingDate: meetings.meetingDate, location: meetings.location,
    })
    .from(meetings)
    .where(and(...conds))
    .orderBy(asc(meetings.meetingDate))
    .limit(limit);
}

export async function getOpenActionItems(scope: CommitteeScope, limit = 10) {
  const conds = [eq(meetings.archived, false), sql`${meetings.actionItems} is not null`];
  const cc = committeeCond(meetings.committee, scope);
  if (cc) conds.push(cc);
  const recent = await db
    .select({ id: meetings.id, title: meetings.title, actionItems: meetings.actionItems, meetingDate: meetings.meetingDate })
    .from(meetings)
    .where(and(...conds))
    .orderBy(desc(meetings.meetingDate))
    .limit(20);
  const items: { text: string; owner?: string | null; due?: string | null; meeting: string }[] = [];
  for (const m of recent) {
    for (const it of (m.actionItems ?? [])) {
      items.push({ ...it, meeting: m.title });
    }
  }
  return items.slice(0, limit);
}

export async function getDocuments(scope: CommitteeScope, opts: { type?: string } = {}) {
  const conds = [eq(documents.archived, false)];
  if (opts.type) conds.push(eq(documents.type, opts.type));
  const cc = committeeCond(documents.committee, scope);
  if (cc) conds.push(cc);
  return db
    .select({
      id: documents.id, title: documents.title, type: documents.type, status: documents.status,
      committee: documents.committee,
      assigneeId: documents.assigneeId, updatedAt: documents.updatedAt, assigneeName: people.name,
    })
    .from(documents)
    .leftJoin(people, eq(documents.assigneeId, people.id))
    .where(and(...conds))
    .orderBy(desc(documents.updatedAt))
    .limit(100);
}

/** Documents linked to a task (via document.related_task_id). Committee-scoped
 * the same way the Docs list is, so a viewer never sees out-of-scope docs on a
 * task. Surfaced as a "Linked documents" section on the task edit page. */
export type TaskDocumentRow = Awaited<ReturnType<typeof getTaskDocuments>>[number];

export async function getTaskDocuments(taskId: number, scope: CommitteeScope) {
  const conds = [eq(documents.relatedTaskId, taskId), eq(documents.archived, false)];
  const cc = committeeCond(documents.committee, scope);
  if (cc) conds.push(cc);
  return db
    .select({
      id: documents.id, title: documents.title, type: documents.type,
      status: documents.status, updatedAt: documents.updatedAt,
    })
    .from(documents)
    .where(and(...conds))
    .orderBy(desc(documents.updatedAt));
}

/** Documents attached to an event (document.related_event_id), committee-scoped
 * exactly like the Docs list — a viewer never sees out-of-scope docs here. Each
 * row carries the linked task's title (when attached to one) so the event page
 * can show "↳ task", plus `content` so the inline editor can prefill without a
 * second round-trip (a per-event doc set is small). Surfaced as a managed
 * "Documents" section on the event detail page. */
export type EventDocumentRow = Awaited<ReturnType<typeof getEventDocuments>>[number];

export async function getEventDocuments(eventId: number, scope: CommitteeScope) {
  const conds = [eq(documents.relatedEventId, eventId), eq(documents.archived, false)];
  const cc = committeeCond(documents.committee, scope);
  if (cc) conds.push(cc);
  return db
    .select({
      id: documents.id,
      title: documents.title,
      type: documents.type,
      status: documents.status,
      content: documents.content,
      updatedAt: documents.updatedAt,
      relatedTaskId: documents.relatedTaskId,
      relatedTaskTitle: tasks.title,
    })
    .from(documents)
    .leftJoin(tasks, eq(documents.relatedTaskId, tasks.id))
    .where(and(...conds))
    .orderBy(desc(documents.updatedAt));
}

// ===========================================================================
// Sponsors (pipeline)
// ===========================================================================

export async function getSponsorPipeline() {
  return db
    .select()
    .from(sponsors)
    .where(eq(sponsors.archived, false))
    .orderBy(desc(sponsors.valueAud));
}

/** Individual people on a sponsorship (linked or free-text), with roles. */
export type SponsorContactRow = Awaited<ReturnType<typeof getSponsorContacts>>[number];

export async function getSponsorContacts(sponsorId: number) {
  return db
    .select({
      id: sponsorContacts.id,
      personId: sponsorContacts.personId,
      name: sponsorContacts.name,
      role: sponsorContacts.role,
      email: sponsorContacts.email,
      phone: sponsorContacts.phone,
      notes: sponsorContacts.notes,
      personName: people.name,
      personEmail: people.email,
    })
    .from(sponsorContacts)
    .leftJoin(people, eq(sponsorContacts.personId, people.id))
    .where(and(eq(sponsorContacts.sponsorId, sponsorId), eq(sponsorContacts.archived, false)))
    .orderBy(asc(sponsorContacts.sortOrder), asc(sponsorContacts.id));
}

// --- Related tasks (cross-entity connections) ------------------------------
// Tasks can be tagged to a sponsor/event/project; the same shape is surfaced on
// each of their detail pages (the per-entity task board). One query, keyed by
// which relation column to filter on.

/** Which `tasks` column links to a given parent entity. */
export type TaskParentKind = "sponsor" | "event" | "project";
const TASK_PARENT_COLUMN = {
  sponsor: tasks.relatedSponsorId,
  event: tasks.relatedEventId,
  project: tasks.relatedProjectId,
} as const;

export type RelatedTaskRow = Awaited<ReturnType<typeof getRelatedTasks>>[number];

/** Active tasks linked to a parent entity, open tasks first. */
export async function getRelatedTasks(kind: TaskParentKind, parentId: number) {
  return db
    .select({
      id: tasks.id,
      title: tasks.title,
      status: tasks.status,
      priority: tasks.priority,
      dueDate: tasks.dueDate,
      completedAt: tasks.completedAt,
      assigneeName: people.name,
    })
    .from(tasks)
    .leftJoin(people, eq(tasks.assigneeId, people.id))
    .where(and(eq(TASK_PARENT_COLUMN[kind], parentId), eq(tasks.archived, false)))
    .orderBy(sql`${tasks.completedAt} is not null`, asc(tasks.id));
}

/** Tasks tagged to a sponsor — kept as a named alias for existing callers. */
export type SponsorTaskRow = RelatedTaskRow;
export function getSponsorTasks(sponsorId: number) {
  return getRelatedTasks("sponsor", sponsorId);
}

/** Events this sponsor is linked to, via the event_sponsor m2m link (the same
 * relation that drives the public event page's sponsor wall). `tier` is the
 * optional per-event label set when the sponsor was added to that event. */
export type SponsorEventRow = Awaited<ReturnType<typeof getSponsorEvents>>[number];

export async function getSponsorEvents(sponsorId: number) {
  return db
    .select({
      id: events.id,
      name: events.name,
      status: events.status,
      startDate: events.startDate,
      tier: eventSponsors.tier,
    })
    .from(eventSponsors)
    .innerJoin(events, eq(eventSponsors.eventId, events.id))
    .where(
      and(
        eq(eventSponsors.sponsorId, sponsorId),
        eq(eventSponsors.archived, false),
        eq(events.archived, false),
      ),
    )
    .orderBy(desc(events.startDate));
}

/** Uploaded documents/images attached to a sponsor. */
export type AttachmentRow = Awaited<ReturnType<typeof getSponsorAttachments>>[number];

export async function getSponsorAttachments(sponsorId: number) {
  return db
    .select()
    .from(attachments)
    .where(
      and(
        eq(attachments.archived, false),
        eq(attachments.entityType, "sponsor"),
        eq(attachments.entityId, sponsorId),
      ),
    )
    .orderBy(asc(attachments.sortOrder), asc(attachments.id));
}

// ===========================================================================
// Usage stats (admin)
// ===========================================================================

export async function getUsageSummary() {
  const today = todayISO();
  const [s] = await db
    .select({
      total: count(),
      mcp: sql<number>`count(*) filter (where ${usageEvents.source} = 'mcp')`,
      dashboard: sql<number>`count(*) filter (where ${usageEvents.source} = 'dashboard')`,
      today: sql<number>`count(*) filter (where ${usageEvents.createdAt} >= ${today})`,
      activeMembers: sql<number>`count(distinct ${usageEvents.actorLabel})`,
    })
    .from(usageEvents);
  return {
    total: num(s?.total), mcp: num(s?.mcp), dashboard: num(s?.dashboard),
    today: num(s?.today), activeMembers: num(s?.activeMembers),
  };
}

export async function getUsageByMember() {
  return db
    .select({
      actorLabel: usageEvents.actorLabel,
      actorType: usageEvents.actorType,
      total: count(),
      dashboard: sql<number>`count(*) filter (where ${usageEvents.source} = 'dashboard')`,
      mcp: sql<number>`count(*) filter (where ${usageEvents.source} = 'mcp')`,
      creates: sql<number>`count(*) filter (where ${usageEvents.action} = 'create')`,
      updates: sql<number>`count(*) filter (where ${usageEvents.action} = 'update')`,
      lastActive: sql<string>`max(${usageEvents.createdAt})`,
    })
    .from(usageEvents)
    .groupBy(usageEvents.actorLabel, usageEvents.actorType)
    .orderBy(desc(count()))
    .limit(100);
}

export async function getRecentActivity(limit = 30) {
  return db.select().from(usageEvents).orderBy(desc(usageEvents.createdAt)).limit(limit);
}

// ===========================================================================
// By-id loaders + <select> option lists (for the CRUD forms)
// ===========================================================================

export async function getProjectById(id: number) {
  const [row] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return row ?? null;
}
export async function getTaskById(id: number) {
  const [row] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  return row ?? null;
}
export async function getBoardById(id: number) {
  const [row] = await db.select().from(taskBoards).where(eq(taskBoards.id, id)).limit(1);
  return row ?? null;
}
export async function getMeetingById(id: number, scope: CommitteeScope) {
  const conds = [eq(meetings.id, id)];
  const cc = committeeCond(meetings.committee, scope);
  if (cc) conds.push(cc);
  const [row] = await db.select().from(meetings).where(and(...conds)).limit(1);
  return row ?? null; // out-of-scope meetings read as not-found
}

/**
 * Look up a meeting by its PUBLIC agenda share token — used by the no-auth
 * /agenda/[token] view. Only resolves once the agenda is `shared` or `locked`
 * (a draft, a wrong token, or an archived meeting all read as not-found), so a
 * draft agenda is never reachable from the public link.
 */
export async function getMeetingByAgendaToken(token: string) {
  if (!token) return null;
  const [row] = await db
    .select()
    .from(meetings)
    .where(
      and(
        eq(meetings.agendaShareToken, token),
        inArray(meetings.agendaStatus, ["shared", "locked"]),
        eq(meetings.archived, false),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Resolve {id, name} for a set of person ids, for PUBLIC display on the agenda
 * share page. EXCLUDES admin-only people so a sensitive internal contact can
 * never leak through a shared link — an admin-only owner simply renders with no
 * name. Archived people are still resolved: a former member who owned an item
 * isn't sensitive (names are public on the team page), and hiding the name would
 * just confuse invitees. Returns a Map for lookup. */
export async function getPeopleNamesByIds(ids: number[]): Promise<Map<number, string>> {
  const unique = [...new Set(ids.filter((n) => Number.isFinite(n) && n > 0))];
  if (!unique.length) return new Map();
  const rows = await db
    .select({ id: people.id, name: people.name })
    .from(people)
    .where(and(inArray(people.id, unique), eq(people.adminOnly, false)));
  return new Map(rows.map((r) => [r.id, r.name]));
}
export async function getDocumentById(id: number, scope: CommitteeScope) {
  const conds = [eq(documents.id, id)];
  const cc = committeeCond(documents.committee, scope);
  if (cc) conds.push(cc);
  const [row] = await db.select().from(documents).where(and(...conds)).limit(1);
  return row ?? null;
}

export type MediaItem = Awaited<ReturnType<typeof getMedia>>[number];

/** The entity kinds that can own uploaded media (mirrors dsec-api ENTITY_TYPES). */
export type MediaEntityType = "event" | "project" | "sponsor" | "speaker" | "person" | "partner";

/** Images attached to an entity, ordered for the dashboard gallery. */
export async function getMedia(entityType: MediaEntityType, entityId: number) {
  return db
    .select()
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.archived, false),
        eq(mediaAssets.entityType, entityType),
        eq(mediaAssets.entityId, entityId),
      ),
    )
    .orderBy(asc(mediaAssets.sortOrder), asc(mediaAssets.id));
}

export type Option = { id: number; name: string };

export async function getPersonOptions(): Promise<Option[]> {
  return db.select({ id: people.id, name: people.name }).from(people)
    .where(eq(people.archived, false)).orderBy(asc(people.name));
}
export async function getEventOptions(): Promise<Option[]> {
  return db.select({ id: events.id, name: events.name }).from(events)
    .where(eq(events.archived, false)).orderBy(desc(events.startDate));
}
export async function getProjectOptions(): Promise<Option[]> {
  return db.select({ id: projects.id, name: projects.name }).from(projects)
    .where(eq(projects.archived, false)).orderBy(asc(projects.name));
}
export async function getBoardOptions(): Promise<Option[]> {
  return db.select({ id: taskBoards.id, name: taskBoards.name }).from(taskBoards)
    .where(eq(taskBoards.archived, false)).orderBy(asc(taskBoards.name));
}
export async function getMeetingOptions(scope: CommitteeScope): Promise<Option[]> {
  const conds = [eq(meetings.archived, false)];
  const cc = committeeCond(meetings.committee, scope);
  if (cc) conds.push(cc);
  return db.select({ id: meetings.id, name: meetings.title }).from(meetings)
    .where(and(...conds)).orderBy(desc(meetings.meetingDate));
}
/** Tasks for the doc "Related task" picker — recent first, capped (tasks are
 * the most numerous entity, so an unbounded <select> would be unwieldy). */
export async function getTaskOptions(): Promise<Option[]> {
  return db.select({ id: tasks.id, name: tasks.title }).from(tasks)
    .where(eq(tasks.archived, false)).orderBy(desc(tasks.updatedAt)).limit(200);
}
