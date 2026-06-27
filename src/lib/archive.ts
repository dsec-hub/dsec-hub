import "server-only";

import { and, desc, eq, isNull, or } from "drizzle-orm";

import type { IconName } from "@/components/icons";
import { db } from "@/db";
import { finance } from "@/db/schema";
import {
  documents,
  events,
  links,
  meetings,
  partners,
  people,
  projects,
  sponsors,
  taskBoards,
  tasks,
} from "@/db/workspace-schema";
import type { CurrentUser } from "@/lib/dal";
import { formatAUD, formatDate } from "@/lib/format";
import { canAccess, type ModuleKey } from "@/lib/rbac";
import { committeeScopeOf, type CommitteeScope } from "@/lib/scope";

/**
 * The archivable CONTENT entities surfaced in the Archive view. Each key is also
 * a REGISTRY/UndoKey (see lib/undo.ts), so Restore + Delete reuse the existing
 * undo plumbing (snapshot → reverse) rather than inventing a parallel mechanism.
 * The relation/sub-entities (event speakers/sponsors/partners, media, …) carry an
 * `archived` flag too but are managed in-context on their parent, so they are
 * deliberately NOT listed here.
 */
export type ArchiveKey =
  | "event"
  | "task"
  | "board"
  | "project"
  | "meeting"
  | "document"
  | "person"
  | "partner"
  | "sponsor"
  | "finance"
  | "link";

export type ArchivedItem = {
  key: ArchiveKey;
  id: number;
  title: string;
  subtitle: string | null;
};

export type ArchiveGroup = {
  key: ArchiveKey;
  label: string; // plural section heading, e.g. "Events"
  icon: IconName;
  items: ArchivedItem[];
};

type Meta = { module: ModuleKey; label: string; icon: IconName };

/** Display + access metadata per archivable entity. The page renders sections in
 * the `ARCHIVE_ORDER` below; this map supplies each one's module gate + chrome. */
export const ARCHIVE_META: Record<ArchiveKey, Meta> = {
  event: { module: "events", label: "Events", icon: "events" },
  task: { module: "tasks", label: "Tasks", icon: "tasks" },
  board: { module: "tasks", label: "Boards", icon: "tasks" },
  project: { module: "projects", label: "Projects", icon: "projects" },
  meeting: { module: "meetings", label: "Meetings", icon: "meetings" },
  document: { module: "documents", label: "Documents", icon: "documents" },
  person: { module: "people", label: "People", icon: "people" },
  partner: { module: "partners", label: "Partners", icon: "partners" },
  sponsor: { module: "sponsors", label: "Sponsors", icon: "sponsors" },
  finance: { module: "finance", label: "Finance", icon: "finance" },
  link: { module: "links", label: "Links", icon: "link" },
};

/** Section order on the Archive page. */
const ARCHIVE_ORDER: ArchiveKey[] = [
  "event",
  "task",
  "board",
  "project",
  "meeting",
  "document",
  "person",
  "partner",
  "sponsor",
  "finance",
  "link",
];

/** The distinct modules that own at least one archivable entity. */
export const ARCHIVE_MODULES: ModuleKey[] = [
  ...new Set(ARCHIVE_ORDER.map((k) => ARCHIVE_META[k].module)),
];

/** Whether the Archive nav entry / page is available: the user can access at
 * least one archivable module (admins always can). */
export function canSeeArchive(modules: readonly string[] | null | undefined): boolean {
  return ARCHIVE_MODULES.some((m) => canAccess(modules, m));
}

/** Per-type cap so the page stays bounded even with a large backlog. */
const LIMIT = 200;

/** Restrict a committee-scoped column (meeting/document) to what the viewer may
 * see: "all" → no restriction; otherwise own committee + club-wide (null).
 * Mirrors `committeeCond` in workspace-queries.ts. */
function committeeCond(
  column: typeof meetings.committee | typeof documents.committee,
  scope: CommitteeScope,
) {
  if (scope.all) return undefined;
  return scope.committee ? or(isNull(column), eq(column, scope.committee)) : isNull(column);
}

/**
 * Read every archived item the user is allowed to see, grouped by entity type.
 * Each section is gated by module access (a query only runs when the user can
 * access that module), and meetings/documents additionally honour committee
 * visibility. Empty sections are dropped. Ordered newest-id-first within a type.
 */
export async function getArchive(user: CurrentUser): Promise<ArchiveGroup[]> {
  const can = (m: ModuleKey) => canAccess(user.modules, m);
  const scope = committeeScopeOf(user);
  const empty = Promise.resolve([] as never[]);

  const [
    eventRows,
    taskRows,
    boardRows,
    projectRows,
    meetingRows,
    documentRows,
    personRows,
    partnerRows,
    sponsorRows,
    financeRows,
    linkRows,
  ] = await Promise.all([
    can("events")
      ? db
          .select({ id: events.id, name: events.name, startDate: events.startDate })
          .from(events)
          .where(eq(events.archived, true))
          .orderBy(desc(events.id))
          .limit(LIMIT)
      : empty,
    can("tasks")
      ? db
          .select({ id: tasks.id, title: tasks.title, status: tasks.status })
          .from(tasks)
          .where(eq(tasks.archived, true))
          .orderBy(desc(tasks.id))
          .limit(LIMIT)
      : empty,
    can("tasks")
      ? db
          .select({ id: taskBoards.id, name: taskBoards.name })
          .from(taskBoards)
          .where(eq(taskBoards.archived, true))
          .orderBy(desc(taskBoards.id))
          .limit(LIMIT)
      : empty,
    can("projects")
      ? db
          .select({ id: projects.id, name: projects.name, status: projects.status })
          .from(projects)
          .where(eq(projects.archived, true))
          .orderBy(desc(projects.id))
          .limit(LIMIT)
      : empty,
    can("meetings")
      ? db
          .select({ id: meetings.id, title: meetings.title, meetingDate: meetings.meetingDate })
          .from(meetings)
          .where(and(eq(meetings.archived, true), committeeCond(meetings.committee, scope)))
          .orderBy(desc(meetings.id))
          .limit(LIMIT)
      : empty,
    can("documents")
      ? db
          .select({ id: documents.id, title: documents.title, type: documents.type })
          .from(documents)
          .where(and(eq(documents.archived, true), committeeCond(documents.committee, scope)))
          .orderBy(desc(documents.id))
          .limit(LIMIT)
      : empty,
    can("people")
      ? db
          .select({
            id: people.id,
            name: people.name,
            roleTitle: people.roleTitle,
            committee: people.committee,
          })
          .from(people)
          .where(eq(people.archived, true))
          .orderBy(desc(people.id))
          .limit(LIMIT)
      : empty,
    can("partners")
      ? db
          .select({ id: partners.id, name: partners.name, status: partners.status })
          .from(partners)
          .where(eq(partners.archived, true))
          .orderBy(desc(partners.id))
          .limit(LIMIT)
      : empty,
    can("sponsors")
      ? db
          .select({ id: sponsors.id, organisation: sponsors.organisation, stage: sponsors.stage })
          .from(sponsors)
          .where(eq(sponsors.archived, true))
          .orderBy(desc(sponsors.id))
          .limit(LIMIT)
      : empty,
    can("finance")
      ? db
          .select({ id: finance.id, item: finance.item, type: finance.type, amountAud: finance.amountAud })
          .from(finance)
          .where(eq(finance.archived, true))
          .orderBy(desc(finance.id))
          .limit(LIMIT)
      : empty,
    can("links")
      ? db
          .select({ id: links.id, title: links.title, url: links.url })
          .from(links)
          .where(eq(links.archived, true))
          .orderBy(desc(links.id))
          .limit(LIMIT)
      : empty,
  ]);

  const items: Record<ArchiveKey, ArchivedItem[]> = {
    event: eventRows.map((r) => ({
      key: "event" as const,
      id: r.id,
      title: r.name,
      subtitle: r.startDate ? formatDate(r.startDate) : null,
    })),
    task: taskRows.map((r) => ({
      key: "task" as const,
      id: r.id,
      title: r.title,
      subtitle: r.status ?? null,
    })),
    board: boardRows.map((r) => ({
      key: "board" as const,
      id: r.id,
      title: r.name,
      subtitle: null,
    })),
    project: projectRows.map((r) => ({
      key: "project" as const,
      id: r.id,
      title: r.name,
      subtitle: r.status ?? null,
    })),
    meeting: meetingRows.map((r) => ({
      key: "meeting" as const,
      id: r.id,
      title: r.title,
      subtitle: r.meetingDate ? formatDate(r.meetingDate) : null,
    })),
    document: documentRows.map((r) => ({
      key: "document" as const,
      id: r.id,
      title: r.title,
      subtitle: r.type ?? null,
    })),
    person: personRows.map((r) => ({
      key: "person" as const,
      id: r.id,
      title: r.name,
      subtitle: r.roleTitle ?? r.committee ?? null,
    })),
    partner: partnerRows.map((r) => ({
      key: "partner" as const,
      id: r.id,
      title: r.name,
      subtitle: r.status ?? null,
    })),
    sponsor: sponsorRows.map((r) => ({
      key: "sponsor" as const,
      id: r.id,
      title: r.organisation,
      subtitle: r.stage ?? null,
    })),
    finance: financeRows.map((r) => ({
      key: "finance" as const,
      id: r.id,
      title: r.item,
      subtitle:
        [r.type, r.amountAud != null ? formatAUD(r.amountAud) : null].filter(Boolean).join(" · ") ||
        null,
    })),
    link: linkRows.map((r) => ({
      key: "link" as const,
      id: r.id,
      title: r.title,
      subtitle: r.url,
    })),
  };

  return ARCHIVE_ORDER.map((key) => ({
    key,
    label: ARCHIVE_META[key].label,
    icon: ARCHIVE_META[key].icon,
    items: items[key],
  })).filter((g) => g.items.length > 0);
}
