/**
 * Drizzle table definitions for the workspace + DUSA-import tables (owned by
 * dsec-api / Alembic). Kept in a SEPARATE file from the drizzle-kit-pulled
 * `schema.ts` so it never collides with that generated/RBAC-augmented file.
 *
 * Only columns are declared (no indexes/FKs) — those already exist in Neon via
 * Alembic; Drizzle needs only the column map to read/write. Re-declares
 * people/events/sponsors here (with the new columns) so queries are fully
 * self-contained and immune to schema.ts churn.
 */

import {
  pgTable, serial, varchar, text, integer, boolean, date, timestamp, numeric, json,
} from "drizzle-orm/pg-core";

const ts = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "string" });

/** A meeting attendee: a linked person (with id) or a free-text guest. */
export type Attendee = { personId?: number | null; name: string };

/**
 * One pre-meeting agenda item, as stored in the `meeting.agenda_items` JSONB.
 * Keys are snake_case because dsec-api (Pydantic / the REST + MCP path) reads and
 * writes the SAME column — both sides must agree on the on-disk shape.
 */
export type AgendaItem = {
  id: string;
  order: number;
  title: string;
  owner_person_id?: number | null;
  duration_minutes?: number | null;
  notes?: string | null; // markdown
  related_task_id?: number | null;
  related_event_id?: number | null;
};

// --- domain tables (re-declared with the columns dsec-api added) ----------

export const people = pgTable("people", {
  id: serial().primaryKey(),
  name: varchar({ length: 256 }).notNull(),
  type: varchar({ length: 64 }),
  committee: varchar({ length: 128 }),
  roleTitle: varchar("role_title", { length: 128 }),
  email: varchar({ length: 256 }),
  status: varchar({ length: 32 }),
  studentId: varchar("student_id", { length: 32 }),
  discord: varchar({ length: 128 }),
  instagram: varchar({ length: 128 }),
  github: varchar({ length: 128 }),
  linkedin: varchar({ length: 256 }),
  website: varchar({ length: 256 }),
  notes: text(),
  // Public website fields (dsec-api migration c5a7e9f1b3d6).
  bio: text(),
  showOnWebsite: boolean("show_on_website").default(false).notNull(),
  displayOrder: integer("display_order").default(0).notNull(),
  // Admin-only internal visibility (see schema.ts people.adminOnly).
  adminOnly: boolean("admin_only").default(false).notNull(),
  archived: boolean().default(false).notNull(),
});

export const events = pgTable("events", {
  id: serial().primaryKey(),
  name: varchar({ length: 512 }).notNull(),
  type: varchar({ length: 64 }),
  status: varchar({ length: 32 }),
  startDate: date("start_date"),
  endDate: date("end_date"),
  trimester: varchar({ length: 32 }),
  format: varchar({ length: 64 }),
  venue: varchar({ length: 256 }),
  eventLeadId: integer("event_lead_id"),
  committee: varchar({ length: 128 }),
  supportTypes: json("support_types").$type<string[]>(),
  partnerOrg: varchar("partner_org", { length: 256 }),
  relatedSponsorId: integer("related_sponsor_id"),
  dusaSubmissionStatus: varchar("dusa_submission_status", { length: 64 }),
  dusaDeadline: date("dusa_deadline"),
  expectedAttendance: integer("expected_attendance"),
  actualAttendance: integer("actual_attendance"),
  // Explicit name required: `events` is also defined in schema.ts (which has
  // `description` instead of `notes`). drizzle's CasingCache is shared per
  // physical table name across the one db instance, so a no-name (keyAsName)
  // column unique to one definition resolves to `undefined` when the other
  // definition was queried first → escapeName(undefined) crash. See schema.ts.
  notes: text("notes"),
  budgetAud: numeric("budget_aud", { precision: 12, scale: 2 }),
  grantAud: numeric("grant_aud", { precision: 12, scale: 2 }),
  // Draft (false) vs published (true) — mirrors schema.ts events / projects.
  // Hidden from the public website until published. See schema.ts for the why.
  isPublic: boolean("is_public").default(false).notNull(),
  createdAt: ts("created_at").defaultNow().notNull(),
  updatedAt: ts("updated_at").defaultNow().notNull(),
  archived: boolean().default(false).notNull(),
});

export const sponsors = pgTable("sponsors", {
  id: serial().primaryKey(),
  organisation: varchar({ length: 256 }).notNull(),
  stage: varchar({ length: 64 }),
  relationshipType: varchar("relationship_type", { length: 32 }),
  contactPersonId: integer("contact_person_id"),
  tier: varchar({ length: 64 }),
  valueAud: numeric("value_aud", { precision: 12, scale: 2 }),
  supportTypes: json("support_types").$type<string[]>(),
  dusaApproved: boolean("dusa_approved").default(false).notNull(),
  showOnWebsite: boolean("show_on_website").default(false).notNull(),
  contactEmail: varchar("contact_email", { length: 256 }),
  // Explicit name required: `sponsors` is also defined in schema.ts without this
  // no-name column, so the shared CasingCache (keyed per physical table name)
  // resolves it to `undefined` when the other definition was queried first →
  // escapeName(undefined) crash. See schema.ts events.description for the why.
  website: varchar("website", { length: 256 }),
  nextAction: varchar("next_action", { length: 512 }),
  nextActionDate: date("next_action_date"),
  lastContactDate: date("last_contact_date"),
  notes: text(),
  archived: boolean().default(false).notNull(),
});

// --- workspace tables ------------------------------------------------------

export const projects = pgTable("project", {
  id: serial().primaryKey(),
  name: varchar({ length: 256 }).notNull(),
  slug: varchar({ length: 256 }),
  summary: varchar({ length: 512 }),
  description: text(),
  status: varchar({ length: 32 }),
  category: varchar({ length: 128 }),
  techTags: json("tech_tags").$type<string[]>(),
  leadId: integer("lead_id"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  repoUrl: varchar("repo_url", { length: 512 }),
  demoUrl: varchar("demo_url", { length: 512 }),
  imageUrl: varchar("image_url", { length: 512 }),
  featured: boolean().default(false).notNull(),
  isPublic: boolean("is_public").default(false).notNull(),
  relatedEventId: integer("related_event_id"),
  notes: text(),
  createdAt: ts("created_at").defaultNow().notNull(),
  updatedAt: ts("updated_at").defaultNow().notNull(),
  archived: boolean().default(false).notNull(),
});

export const taskBoards = pgTable("task_board", {
  id: serial().primaryKey(),
  name: varchar({ length: 256 }).notNull(),
  description: text(),
  committee: varchar({ length: 128 }),
  columns: json().$type<string[]>(),
  archived: boolean().default(false).notNull(),
});

export const tasks = pgTable("task", {
  id: serial().primaryKey(),
  boardId: integer("board_id"),
  // Self-referential parent for one-level subtasks (null = top-level card).
  parentTaskId: integer("parent_task_id"),
  title: varchar({ length: 512 }).notNull(),
  description: text(),
  status: varchar({ length: 64 }).default("Backlog").notNull(),
  position: integer().default(0).notNull(),
  priority: varchar({ length: 16 }),
  assigneeId: integer("assignee_id"),
  committee: varchar({ length: 128 }),
  startDate: date("start_date"),
  dueDate: date("due_date"),
  completedAt: ts("completed_at"),
  relatedEventId: integer("related_event_id"),
  relatedProjectId: integer("related_project_id"),
  relatedSponsorId: integer("related_sponsor_id"),
  createdAt: ts("created_at").defaultNow().notNull(),
  updatedAt: ts("updated_at").defaultNow().notNull(),
  archived: boolean().default(false).notNull(),
});

// --- co-owners (multi-assignee / multi-lead) -------------------------------
// Additional owners beyond each entity's single PRIMARY owner
// (task.assigneeId / events.eventLeadId / project.leadId). One row per
// (entity, person); the primary lives on the entity row, not here. Owned by
// dsec-api (Alembic migration b6e9c2a4f1d7).

export const taskOwners = pgTable("task_owner", {
  id: serial().primaryKey(),
  taskId: integer("task_id").notNull(),
  personId: integer("person_id").notNull(),
  createdAt: ts("created_at").defaultNow().notNull(),
});

export const eventOwners = pgTable("event_owner", {
  id: serial().primaryKey(),
  eventId: integer("event_id").notNull(),
  personId: integer("person_id").notNull(),
  createdAt: ts("created_at").defaultNow().notNull(),
});

export const projectOwners = pgTable("project_owner", {
  id: serial().primaryKey(),
  projectId: integer("project_id").notNull(),
  personId: integer("person_id").notNull(),
  createdAt: ts("created_at").defaultNow().notNull(),
});

export const meetings = pgTable("meeting", {
  id: serial().primaryKey(),
  title: varchar({ length: 512 }).notNull(),
  type: varchar({ length: 64 }),
  // Owning committee for visibility scoping (null = club-wide / all-hands).
  // Only that committee + "all"-scope roles (exec/secretary/admin) see it.
  committee: varchar({ length: 128 }),
  meetingDate: date("meeting_date"),
  // Optional local start time, "HH:MM" 24h (dsec-api migration d3b7f1a9c5e2).
  meetingTime: varchar("meeting_time", { length: 8 }),
  location: varchar({ length: 256 }),
  // Either a linked person ({ personId, name }) or a free-text guest ({ name }).
  // Legacy rows may hold plain strings, so reads must normalise (see attendeeName).
  attendees: json().$type<Attendee[]>(),
  transcript: text(),
  summary: text(),
  notes: text(),
  actionItems: json("action_items").$type<{ text: string; owner?: string | null; due?: string | null }[]>(),
  status: varchar({ length: 32 }),
  relatedEventId: integer("related_event_id"),
  createdBy: varchar("created_by", { length: 256 }),
  // Pre-meeting agenda (dsec-api migration c1a4e7b9f2d6). Distinct from the
  // post-meeting transcript/notes/action-items above: built before the meeting
  // and shared read-only with invitees at /agenda/<agendaShareToken>.
  agendaItems: json("agenda_items").$type<AgendaItem[]>(),
  // draft (private) -> shared (public link live) -> locked (frozen at start).
  agendaStatus: varchar("agenda_status", { length: 16 }).default("draft").notNull(),
  agendaSharedAt: ts("agenda_shared_at"),
  agendaShareToken: varchar("agenda_share_token", { length: 64 }),
  createdAt: ts("created_at").defaultNow().notNull(),
  updatedAt: ts("updated_at").defaultNow().notNull(),
  archived: boolean().default(false).notNull(),
});

export const documents = pgTable("document", {
  id: serial().primaryKey(),
  title: varchar({ length: 512 }).notNull(),
  type: varchar({ length: 32 }),
  // Owning committee for visibility scoping (null = club-wide). Meeting-notes
  // docs inherit their meeting's committee so they scope identically.
  committee: varchar({ length: 128 }),
  content: text(),
  contentJson: json("content_json"),
  status: varchar({ length: 32 }),
  parentId: integer("parent_id"),
  assigneeId: integer("assignee_id"),
  relatedEventId: integer("related_event_id"),
  relatedSponsorId: integer("related_sponsor_id"),
  relatedProjectId: integer("related_project_id"),
  relatedMeetingId: integer("related_meeting_id"),
  relatedTaskId: integer("related_task_id"),
  createdBy: varchar("created_by", { length: 256 }),
  createdAt: ts("created_at").defaultNow().notNull(),
  updatedAt: ts("updated_at").defaultNow().notNull(),
  archived: boolean().default(false).notNull(),
});

// --- sponsor contacts ------------------------------------------------------
// Individual people attached to a sponsorship, each with a role. Links a
// `people` row when known, else carries a free-text name. The sponsor's
// headline `contactPersonId` is still the primary contact.

export const sponsorContacts = pgTable("sponsor_contact", {
  id: serial().primaryKey(),
  sponsorId: integer("sponsor_id").notNull(),
  personId: integer("person_id"),
  name: varchar({ length: 256 }),
  role: varchar({ length: 64 }),
  email: varchar({ length: 256 }),
  phone: varchar({ length: 64 }),
  notes: text(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: ts("created_at").defaultNow().notNull(),
  updatedAt: ts("updated_at").defaultNow().notNull(),
  archived: boolean().default(false).notNull(),
});

// --- event speakers --------------------------------------------------------
// A speaker presenting at an event: a linked `people` row (autofills name/title)
// or a free-text guest. The headshot lives in `media_asset`
// (entityType="speaker", entityId=this row's id, role="photo").

export const eventSpeakers = pgTable("event_speaker", {
  id: serial().primaryKey(),
  eventId: integer("event_id").notNull(),
  personId: integer("person_id"),
  name: varchar({ length: 256 }),
  title: varchar({ length: 256 }),
  bio: text(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: ts("created_at").defaultNow().notNull(),
  updatedAt: ts("updated_at").defaultNow().notNull(),
  archived: boolean().default(false).notNull(),
});

// --- event sponsors --------------------------------------------------------
// Many-to-many event<->sponsor so an event can show a wall of sponsor logos.
// The logo lives on the sponsor (media_asset entityType="sponsor", role="logo").

export const eventSponsors = pgTable("event_sponsor", {
  id: serial().primaryKey(),
  eventId: integer("event_id").notNull(),
  sponsorId: integer("sponsor_id").notNull(),
  tier: varchar({ length: 64 }),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: ts("created_at").defaultNow().notNull(),
  updatedAt: ts("updated_at").defaultNow().notNull(),
  archived: boolean().default(false).notNull(),
});

// --- partners --------------------------------------------------------------
// A collaborator club / society / external org that co-hosts events. Unlike
// `sponsors` this carries NO pipeline (no stage/value/packages) — just a name,
// website, notes, and an uploadable logo (media_asset entityType="partner",
// role="logo"). Internal-only: shown on the dashboard + linked events, not on
// the public website. Defined ONLY here (a fresh table) so it avoids the
// schema.ts/workspace-schema.ts double-definition trap that sponsors hit.

export const partners = pgTable("partner", {
  id: serial().primaryKey(),
  name: varchar({ length: 256 }).notNull(),
  website: varchar({ length: 256 }),
  notes: text(),
  // Publish this partner's logo on the public events it's linked to (off by
  // default — partners are internal until an exec opts one in).
  showOnWebsite: boolean("show_on_website").default(false).notNull(),
  createdAt: ts("created_at").defaultNow().notNull(),
  updatedAt: ts("updated_at").defaultNow().notNull(),
  archived: boolean().default(false).notNull(),
});

// --- event partners --------------------------------------------------------
// Many-to-many event<->partner so an event can list the clubs it is run in
// collaboration with. The logo lives on the partner (reused across events).

export const eventPartners = pgTable("event_partner", {
  id: serial().primaryKey(),
  eventId: integer("event_id").notNull(),
  partnerId: integer("partner_id").notNull(),
  role: varchar({ length: 64 }), // optional per-event label, e.g. "Co-host"
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: ts("created_at").defaultNow().notNull(),
  updatedAt: ts("updated_at").defaultNow().notNull(),
  archived: boolean().default(false).notNull(),
});

// --- event connections -----------------------------------------------------
// Symmetric, visual-only links between two events ("these events are related").
// One row per pair, stored canonically with eventAId < eventBId (enforced in the
// action layer) so a pair has exactly one row regardless of which event added it.

export const eventConnections = pgTable("event_connection", {
  id: serial().primaryKey(),
  eventAId: integer("event_a_id").notNull(),
  eventBId: integer("event_b_id").notNull(),
  label: varchar({ length: 64 }), // optional relation label shown on both, e.g. "Series"
  createdAt: ts("created_at").defaultNow().notNull(),
  updatedAt: ts("updated_at").defaultNow().notNull(),
  archived: boolean().default(false).notNull(),
});

// --- attachments (PDFs/images) ---------------------------------------------
// Binaries live in Supabase Storage; this row holds only the URL + metadata.
// Written by dsec-api (POST /attachments, which auto-compresses); read here.

export const attachments = pgTable("attachment", {
  id: serial().primaryKey(),
  entityType: varchar("entity_type", { length: 16 }).notNull(), // sponsor
  entityId: integer("entity_id").notNull(),
  kind: varchar({ length: 16 }).notNull(), // image|pdf|file
  title: varchar({ length: 512 }),
  originalFilename: varchar("original_filename", { length: 512 }),
  contentType: varchar("content_type", { length: 128 }),
  url: varchar({ length: 1024 }).notNull(),
  path: varchar({ length: 512 }).notNull(),
  sizeBytes: integer("size_bytes"),
  originalSizeBytes: integer("original_size_bytes"),
  width: integer(),
  height: integer(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: ts("created_at").defaultNow().notNull(),
  updatedAt: ts("updated_at").defaultNow().notNull(),
  archived: boolean().default(false).notNull(),
});

// --- DUSA imports ----------------------------------------------------------

export const members = pgTable("members", {
  id: serial().primaryKey(),
  studentId: varchar("student_id", { length: 32 }).notNull(),
  fullName: varchar("full_name", { length: 256 }),
  email: varchar({ length: 256 }),
  campus: varchar({ length: 128 }),
  faculty: varchar({ length: 256 }),
  paymentOption: varchar("payment_option", { length: 256 }),
  membershipType: varchar("membership_type", { length: 32 }),
  dusaMember: boolean("dusa_member").default(false).notNull(),
  firstSubscriptionDate: date("first_subscription_date"),
  lastPaidDate: date("last_paid_date"),
  endDate: date("end_date"),
  isCurrent: boolean("is_current").default(true).notNull(),
  firstSeenAt: ts("first_seen_at").defaultNow().notNull(),
  lastSeenAt: ts("last_seen_at").defaultNow().notNull(),
});

export const memberReports = pgTable("member_report", {
  id: serial().primaryKey(),
  importId: integer("import_id"),
  reportDate: date("report_date"),
  totalMembers: integer("total_members").default(0).notNull(),
  dusaMemberCount: integer("dusa_member_count").default(0).notNull(),
  nonDusaCount: integer("non_dusa_count").default(0).notNull(),
  newCount: integer("new_count").default(0).notNull(),
  renewalCount: integer("renewal_count").default(0).notNull(),
  createdAt: ts("created_at").defaultNow().notNull(),
});

export const financeReports = pgTable("finance_report", {
  id: serial().primaryKey(),
  importId: integer("import_id"),
  reportDate: date("report_date"),
  fyStart: date("fy_start"),
  openingBalance: numeric("opening_balance", { precision: 12, scale: 2 }),
  totalIncome: numeric("total_income", { precision: 12, scale: 2 }),
  totalExpense: numeric("total_expense", { precision: 12, scale: 2 }),
  closingBalance: numeric("closing_balance", { precision: 12, scale: 2 }),
  transactionCount: integer("transaction_count").default(0).notNull(),
  isCurrent: boolean("is_current").default(true).notNull(),
  createdAt: ts("created_at").defaultNow().notNull(),
});

export const financeTransactions = pgTable("finance_transaction", {
  id: serial().primaryKey(),
  reportId: integer("report_id").notNull(),
  postingDate: date("posting_date"),
  documentNo: varchar("document_no", { length: 64 }),
  glAccountNo: varchar("gl_account_no", { length: 16 }),
  glAccountName: varchar("gl_account_name", { length: 256 }),
  description: text(),
  departmentCode: varchar("department_code", { length: 16 }),
  clubCode: varchar("club_code", { length: 32 }),
  amount: numeric({ precision: 12, scale: 2 }),
  amountAbs: numeric("amount_abs", { precision: 12, scale: 2 }),
  kind: varchar({ length: 16 }),
});

// --- image media (events, projects, sponsors, speakers) --------------------
// Binaries live in Supabase Storage; this row holds only URLs + metadata.
// Written by dsec-api (POST /media); read here for the dashboard gallery.

export const mediaAssets = pgTable("media_asset", {
  id: serial().primaryKey(),
  entityType: varchar("entity_type", { length: 16 }).notNull(), // event|project|sponsor|speaker
  entityId: integer("entity_id").notNull(),
  role: varchar({ length: 16 }).notNull(), // image|poster|banner|logo|photo
  altText: varchar("alt_text", { length: 512 }),
  originalFilename: varchar("original_filename", { length: 512 }),
  webpUrl: varchar("webp_url", { length: 1024 }).notNull(),
  pngUrl: varchar("png_url", { length: 1024 }).notNull(),
  webpPath: varchar("webp_path", { length: 512 }).notNull(),
  pngPath: varchar("png_path", { length: 512 }).notNull(),
  width: integer(),
  height: integer(),
  sizeBytes: integer("size_bytes"),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: ts("created_at").defaultNow().notNull(),
  updatedAt: ts("updated_at").defaultNow().notNull(),
  archived: boolean().default(false).notNull(),
});

// --- usage / activity log --------------------------------------------------

export const usageEvents = pgTable("usage_event", {
  id: serial().primaryKey(),
  actorType: varchar("actor_type", { length: 16 }).notNull(),
  actorId: integer("actor_id"),
  actorLabel: varchar("actor_label", { length: 256 }),
  source: varchar({ length: 16 }).notNull(),
  action: varchar({ length: 32 }).notNull(),
  targetType: varchar("target_type", { length: 64 }),
  targetId: varchar("target_id", { length: 64 }),
  path: varchar({ length: 512 }),
  detail: varchar({ length: 512 }),
  createdAt: ts("created_at").defaultNow().notNull(),
});
