import { pgTable, varchar, index, serial, timestamp, json, text, integer, doublePrecision, uniqueIndex, boolean, foreignKey, unique, date, time, numeric } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import type { ViewConfigTV } from "@/lib/task-view-types"
import type { ViewConfigEV } from "@/lib/event-view-types"



export const alembicVersion = pgTable("alembic_version", {
	versionNum: varchar("version_num", { length: 32 }).primaryKey().notNull(),
});

export const eventLog = pgTable("event_log", {
	id: serial().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
	source: varchar({ length: 32 }).notNull(),
	externalId: varchar("external_id", { length: 256 }),
	sender: varchar({ length: 512 }),
	subject: varchar({ length: 1024 }),
	classification: varchar({ length: 64 }),
	action: varchar({ length: 64 }),
	payload: json(),
	output: text(),
	tokens: integer(),
	cost: doublePrecision(),
}, (table) => [
	index("ix_event_log_action").using("btree", table.action.asc().nullsLast().op("text_ops")),
	index("ix_event_log_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("ix_event_log_source").using("btree", table.source.asc().nullsLast().op("text_ops")),
]);

export const apiKey = pgTable("api_key", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 256 }).notNull(),
	prefix: varchar({ length: 64 }).notNull(),
	keyHash: varchar("key_hash", { length: 512 }).notNull(),
	scopes: json().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).notNull(),
	createdBy: varchar("created_by", { length: 256 }),
	lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: 'string' }),
	revoked: boolean().notNull(),
}, (table) => [
	uniqueIndex("ix_api_key_prefix").using("btree", table.prefix.asc().nullsLast().op("text_ops")),
	index("ix_api_key_revoked").using("btree", table.revoked.asc().nullsLast().op("bool_ops")),
]);

export const rateLimit = pgTable("rate_limit", {
	id: serial().primaryKey().notNull(),
	keyId: integer("key_id"),
	bucket: varchar({ length: 128 }).notNull(),
	windowStart: timestamp("window_start", { withTimezone: true, mode: 'string' }).notNull(),
	count: integer().notNull(),
	triggerCountToday: integer("trigger_count_today").notNull(),
}, (table) => [
	index("ix_rate_limit_bucket").using("btree", table.bucket.asc().nullsLast().op("text_ops")),
	index("ix_rate_limit_key_id").using("btree", table.keyId.asc().nullsLast().op("int4_ops")),
	index("ix_rate_limit_window_start").using("btree", table.windowStart.asc().nullsLast().op("timestamptz_ops")),
	index("ix_ratelimit_key_window").using("btree", table.keyId.asc().nullsLast().op("timestamptz_ops"), table.windowStart.asc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.keyId],
			foreignColumns: [apiKey.id],
			name: "rate_limit_key_id_fkey"
		}),
	unique("uq_ratelimit_key_window").on(table.windowStart, table.keyId),
]);

export const people = pgTable("people", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 256 }).notNull(),
	type: varchar({ length: 64 }),
	committee: varchar({ length: 128 }),
	roleTitle: varchar("role_title", { length: 128 }),
	email: varchar({ length: 256 }),
	status: varchar({ length: 32 }),
	// Optional DUSA student id — links to the live `members` roster by student id.
	studentId: varchar("student_id", { length: 32 }),
	// Self-managed social / portfolio links (edited via the profile page).
	discord: varchar({ length: 128 }),
	instagram: varchar({ length: 128 }),
	github: varchar({ length: 128 }),
	linkedin: varchar({ length: 256 }),
	website: varchar({ length: 256 }),
	notes: text(),
	// Public website fields (added by dsec-api migration c5a7e9f1b3d6).
	// `bio` is a public one-line intro (distinct from internal `notes`);
	// `showOnWebsite` opts the person into the public team grid; `displayOrder`
	// orders that grid (lower first). The headshot lives in `media_asset`
	// (entityType="person", role="photo"), not on this row.
	bio: text(),
	showOnWebsite: boolean("show_on_website").default(false).notNull(),
	displayOrder: integer("display_order").default(0).notNull(),
	// Internal visibility: when true, only admin users see this person in the app
	// (People list + detail). Lets the exec keep sensitive contacts off the
	// general committee's view. Distinct from `show_on_website` (public site) and
	// `archived` (soft delete). Added by scripts/add-people-admin-only-column.ts.
	adminOnly: boolean("admin_only").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	archived: boolean().default(false).notNull(),
}, (table) => [
	index("ix_people_archived").using("btree", table.archived.asc().nullsLast().op("bool_ops")),
	index("ix_people_committee").using("btree", table.committee.asc().nullsLast().op("text_ops")),
	index("ix_people_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("ix_people_student_id").using("btree", table.studentId.asc().nullsLast().op("text_ops")),
	index("ix_people_type").using("btree", table.type.asc().nullsLast().op("text_ops")),
]);

export const events = pgTable("events", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 512 }).notNull(),
	type: varchar({ length: 64 }),
	status: varchar({ length: 32 }),
	startDate: date("start_date"),
	endDate: date("end_date"),
	// Time-of-day the event runs, "HH:MM:SS" (no timezone). App-owned columns
	// added by scripts/add-event-time-columns.ts, not Alembic — see schema notes.
	startTime: time("start_time"),
	endTime: time("end_time"),
	trimester: varchar({ length: 32 }),
	format: varchar({ length: 64 }),
	venue: varchar({ length: 256 }),
	// Public buy-tickets / register link, shown on the website event page.
	ticketUrl: varchar("ticket_url", { length: 1024 }),
	// Tiered ticket pricing: [{label, price}] — price 0 = free, null = unset.
	ticketTiers: json("ticket_tiers").$type<{ label: string; price: number | null }[]>(),
	eventLeadId: integer("event_lead_id"),
	committee: varchar({ length: 128 }),
	supportTypes: json("support_types").$type<string[]>(),
	partnerOrg: varchar("partner_org", { length: 256 }),
	relatedSponsorId: integer("related_sponsor_id"),
	dusaSubmissionStatus: varchar("dusa_submission_status", { length: 64 }),
	dusaDeadline: date("dusa_deadline"),
	dusaRequired: boolean("dusa_required").default(false).notNull(),
	foodProvided: boolean("food_provided").default(false).notNull(),
	externalGuests: boolean("external_guests").default(false).notNull(),
	expectedAttendance: integer("expected_attendance"),
	actualAttendance: integer("actual_attendance"),
	// Explicit name required: `events` is also defined in workspace-schema.ts
	// (which has `notes` instead of `description`). drizzle's CasingCache is
	// shared per physical table name across the one db instance, so a no-name
	// (keyAsName) column unique to one definition resolves to `undefined` when
	// the other definition was queried first → escapeName(undefined) crash.
	description: text("description"),
	// Post-event review form (Tally) — set by the dsec-api reviews feature when a
	// form is created; null means none yet. URL is the public fill link.
	reviewFormId: varchar("review_form_id", { length: 64 }),
	reviewFormUrl: varchar("review_form_url", { length: 512 }),
	reviewFormCreatedAt: timestamp("review_form_created_at", { withTimezone: true, mode: 'string' }),
	// Draft (false) vs published (true). New events default to draft and are
	// hidden from the public website; the dashboard publishes them. Mirrors
	// projects.is_public. Added via Alembic (a9f3c1e7d2b4) — dsec-api owns events.
	isPublic: boolean("is_public").default(false).notNull(),
	// --- Flagship event marketing feature (app-owned additive columns, added by
	// scripts/add-event-flagship-columns.ts, NOT Alembic). A flagship is a marquee
	// event with a bespoke website template and a teaser→revealed lifecycle: the
	// teaser state hides the real specifics behind a secret headline + countdown +
	// email funnel; flipping to revealed declassifies it to the full page. Mirrors
	// the is_public publish pattern. See FLAGSHIP_CONTRACT.md. ---
	isFlagship: boolean("is_flagship").default(false).notNull(),
	// Which website template renders this flagship: arena | blueprint | nightrun.
	// NOT NULL with a default in Neon (the website always needs a template/lifecycle
	// to render) — inert unless is_flagship is true.
	flagshipTheme: varchar("flagship_theme", { length: 16 }).default("arena").notNull(),
	// Lifecycle: teaser (secret) → revealed (full page).
	flagshipState: varchar("flagship_state", { length: 16 }).default("teaser").notNull(),
	// Secret-state headline (e.g. "OPERATION DUCKSHOT") + Markdown blurb, shown
	// only while in the teaser state.
	flagshipTeaserTitle: varchar("flagship_teaser_title", { length: 256 }),
	flagshipTeaserBody: text("flagship_teaser_body"),
	// Countdown target; the website falls back to start_date when null.
	flagshipRevealAt: timestamp("flagship_reveal_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	archived: boolean().default(false).notNull(),
}, (table) => [
	index("ix_events_archived").using("btree", table.archived.asc().nullsLast().op("bool_ops")),
	index("ix_events_is_public").using("btree", table.isPublic.asc().nullsLast().op("bool_ops")),
	index("ix_events_is_flagship").using("btree", table.isFlagship.asc().nullsLast().op("bool_ops")),
	index("ix_events_dusa_deadline").using("btree", table.dusaDeadline.asc().nullsLast().op("date_ops")),
	index("ix_events_dusa_submission_status").using("btree", table.dusaSubmissionStatus.asc().nullsLast().op("text_ops")),
	index("ix_events_event_lead_id").using("btree", table.eventLeadId.asc().nullsLast().op("int4_ops")),
	index("ix_events_start_date").using("btree", table.startDate.asc().nullsLast().op("date_ops")),
	index("ix_events_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.eventLeadId],
			foreignColumns: [people.id],
			name: "events_event_lead_id_fkey"
		}),
]);

// --- Flagship signups (the email-marketing funnel sink for a flagship event's
// teaser page: "notify me" captures + sponsor enquiries). The TABLE is created
// by the dsec-api migration; the hub only READS it (the event detail page's
// signups panel + CSV export). Mirrors the API `flagship_signup` schema —
// see FLAGSHIP_CONTRACT.md. ---

export const flagshipSignups = pgTable("flagship_signup", {
	id: serial().primaryKey().notNull(),
	eventId: integer("event_id").notNull(),
	// notify | sponsor
	kind: varchar({ length: 16 }).notNull(),
	email: varchar({ length: 320 }).notNull(),
	name: varchar({ length: 256 }),
	// sponsor-only context
	company: varchar({ length: 256 }),
	message: text(),
	// where the signup came from, e.g. "website"
	source: varchar({ length: 64 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	archived: boolean().default(false).notNull(),
}, (table) => [
	// Idempotent re-submits: one (event, kind, email) tuple at most.
	uniqueIndex("ix_flagship_signup_event_kind_email").using(
		"btree",
		table.eventId.asc().nullsLast().op("int4_ops"),
		table.kind.asc().nullsLast().op("text_ops"),
		table.email.asc().nullsLast().op("text_ops"),
	),
	index("ix_flagship_signup_event_id").using("btree", table.eventId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.eventId],
			foreignColumns: [events.id],
			name: "flagship_signup_event_id_fkey"
		}).onDelete("cascade"),
]);

export const sponsors = pgTable("sponsors", {
	id: serial().primaryKey().notNull(),
	organisation: varchar({ length: 256 }).notNull(),
	stage: varchar({ length: 64 }),
	relationshipType: varchar("relationship_type", { length: 32 }),
	contactPersonId: integer("contact_person_id"),
	tier: varchar({ length: 64 }),
	valueAud: numeric("value_aud", { precision: 12, scale:  2 }),
	supportTypes: json("support_types").$type<string[]>(),
	dusaApproved: boolean("dusa_approved").default(false).notNull(),
	showOnWebsite: boolean("show_on_website").default(false).notNull(),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	archived: boolean().default(false).notNull(),
}, (table) => [
	index("ix_sponsors_archived").using("btree", table.archived.asc().nullsLast().op("bool_ops")),
	index("ix_sponsors_contact_person_id").using("btree", table.contactPersonId.asc().nullsLast().op("int4_ops")),
	index("ix_sponsors_stage").using("btree", table.stage.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.contactPersonId],
			foreignColumns: [people.id],
			name: "sponsors_contact_person_id_fkey"
		}),
]);

export const finance = pgTable("finance", {
	id: serial().primaryKey().notNull(),
	item: varchar({ length: 256 }).notNull(),
	type: varchar({ length: 64 }),
	amountAud: numeric("amount_aud", { precision: 12, scale:  2 }),
	gstIncluded: boolean("gst_included").default(false).notNull(),
	status: varchar({ length: 32 }),
	dateRequested: date("date_requested"),
	datePaid: date("date_paid"),
	notes: text(),
	relatedEventId: integer("related_event_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	archived: boolean().default(false).notNull(),
}, (table) => [
	index("ix_finance_archived").using("btree", table.archived.asc().nullsLast().op("bool_ops")),
	index("ix_finance_related_event_id").using("btree", table.relatedEventId.asc().nullsLast().op("int4_ops")),
	index("ix_finance_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("ix_finance_type").using("btree", table.type.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.relatedEventId],
			foreignColumns: [events.id],
			name: "finance_related_event_id_fkey"
		}),
]);

// --- Role-based access control (owned by dsec-app; created via
// `scripts/setup-roles.ts`, NOT by Alembic). A role maps to a set of module
// keys; a role carrying the "admin" module is a superuser. ---

/**
 * Per-ROLE presentation/focus config (the "Focus" layer). Stored as JSON on
 * `app_role.view_config`. This NEVER grants access beyond `modules` — it only
 * chooses what is surfaced first and how, of the things the role may already
 * see. Consumers (dashboard, nav, post-login redirect, tasks default view)
 * always hard-gate with `requireModule`/`canAccess` BEFORE consulting this.
 *
 *   • sections        — which dashboard section ids are visible (see
 *                       dashboard/dashboard-config.ts CANONICAL_SECTIONS).
 *   • landingPath      — post-login + access-denied bounce target (a default,
 *                       NOT a jail). Validated against the role's modules.
 *   • defaultTaskView — a built-in view KEY string (never an FK).
 *   • navOrder        — optional reorder/narrow of nav GROUP labels.
 *
 * Distinct from `ViewConfigTV` (lib/task-view-types.ts) which is per-VIEW.
 */
export type ViewConfig = {
  version: 1;
  sections: Record<string, boolean>;
  landingPath?: string;
  defaultTaskView?: string;
  navOrder?: string[];
  // Committee-scoped visibility for meetings + meeting-notes documents:
  //   "all"  → sees every committee's meetings/notes (Exec/Secretary/Admin/Auditor)
  //   "own"  → only their own committee's + club-wide (Leads/Members)
  committeeScope?: "all" | "own";
};

export const appRole = pgTable("app_role", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 64 }).notNull(),
	description: varchar({ length: 256 }),
	// JSON array of module keys, e.g. ["events","finance"]. "admin" = full access.
	modules: json().$type<string[]>().default([]).notNull(),
	// Subset of `modules` this role may also EDIT (write ⊆ read). Modules in
	// `modules` but not here are view-only. "admin" implies write everywhere.
	writeModules: json("write_modules").$type<string[]>().default([]).notNull(),
	// Per-role Focus/presentation config (see ViewConfig above). Nullable; the
	// DAL normalises null/legacy shapes to a safe default. Added app-side via
	// `scripts/add-app-role-view-config-column.ts`, NOT via Alembic.
	viewConfig: json("view_config").$type<ViewConfig>(),
	// System roles (e.g. Admin) cannot be deleted from the UI.
	isSystem: boolean("is_system").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("ix_app_role_name").using("btree", sql`lower(${table.name})`),
]);

export const appUser = pgTable("app_user", {
	id: serial().primaryKey().notNull(),
	email: varchar({ length: 256 }).notNull(),
	name: varchar({ length: 256 }),
	passwordHash: varchar("password_hash", { length: 512 }).notNull(),
	role: varchar({ length: 32 }).default('exec').notNull(),
	roleId: integer("role_id"),
	// Per-user privilege overrides, UNION-ed with the role at read time (dal.ts).
	// `extraModules` = extra read access; `extraWriteModules` = extra edit access.
	// Elevate-only; "admin" is intentionally never granted here (role-only).
	extraModules: json("extra_modules").$type<string[]>().default([]).notNull(),
	extraWriteModules: json("extra_write_modules").$type<string[]>().default([]).notNull(),
	// Optional link to this login's roster record. Set on invite acceptance
	// (match by email, else a new people row is created) — see invite/[token].
	personId: integer("person_id"),
	// Per-user UI theme (Appearance settings). Null = brand default.
	themeAccent: varchar("theme_accent", { length: 16 }),
	themeBackground: varchar("theme_background", { length: 16 }),
	themeFontTitle: varchar("theme_font_title", { length: 32 }),
	themeFontBody: varchar("theme_font_body", { length: 32 }),
	themeWeightTitle: varchar("theme_weight_title", { length: 16 }),
	themeWeightBody: varchar("theme_weight_body", { length: 16 }),
	// Null until the member finishes the first-run onboarding wizard. The (app)
	// layout forces incomplete users to /onboarding; an admin can clear this to
	// send someone through it again. Added app-side (scripts/), not via Alembic.
	onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true, mode: 'string' }),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("ix_app_user_email").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("ix_app_user_is_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	index("ix_app_user_person_id").using("btree", table.personId.asc().nullsLast().op("int4_ops")),
	index("ix_app_user_role_id").using("btree", table.roleId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.roleId],
			foreignColumns: [appRole.id],
			name: "app_user_role_id_fkey"
		}),
	foreignKey({
			columns: [table.personId],
			foreignColumns: [people.id],
			name: "app_user_person_id_fkey"
		}),
]);

// --- Per-user saved Tasks views (app-owned; created via
// `scripts/add-task-view-table.ts`, NOT by Alembic). Each row is one user's
// saved filter/group/sort/mode lens over the task pool. Hub-owned: dsec-api
// never reads this. `config` is typed by ViewConfigTV (lib/task-view-types). ---

export const appTaskView = pgTable("task_view", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	name: varchar({ length: 128 }).notNull(),
	description: text(),
	config: json().$type<ViewConfigTV>().default(sql`'{}'::jsonb`).notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	archived: boolean().default(false).notNull(),
}, (table) => [
	uniqueIndex("ix_task_view_user_name")
		.using("btree", sql`${table.userId}, lower(${table.name})`)
		.where(sql`${table.archived} = false`),
	index("ix_task_view_user_id")
		.using("btree", table.userId.asc().nullsLast().op("int4_ops"))
		.where(sql`${table.archived} = false`),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [appUser.id],
			name: "task_view_user_id_fkey"
		}).onDelete("cascade"),
]);

// --- Per-user saved Events views (app-owned; created via
// `scripts/add-event-view-table.ts`, NOT by Alembic). Each row is one user's
// saved filter/group/sort/mode lens over the events pool. Hub-owned: dsec-api
// never reads this. `config` is typed by ViewConfigEV (lib/event-view-types).
// Mirrors `task_view`. ---

export const appEventView = pgTable("event_view", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	name: varchar({ length: 128 }).notNull(),
	description: text(),
	config: json().$type<ViewConfigEV>().default(sql`'{}'::jsonb`).notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	archived: boolean().default(false).notNull(),
}, (table) => [
	uniqueIndex("ix_event_view_user_name")
		.using("btree", sql`${table.userId}, lower(${table.name})`)
		.where(sql`${table.archived} = false`),
	index("ix_event_view_user_id")
		.using("btree", table.userId.asc().nullsLast().op("int4_ops"))
		.where(sql`${table.archived} = false`),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [appUser.id],
			name: "event_view_user_id_fkey"
		}).onDelete("cascade"),
]);

export const appInvite = pgTable("app_invite", {
	id: serial().primaryKey().notNull(),
	email: varchar({ length: 256 }).notNull(),
	// Optional display name the admin set at invite time. When present a People
	// record is created immediately (see createInvite) so the invitee shows up in
	// /people before they accept; the accept form also prefills it.
	name: varchar({ length: 256 }),
	// The roster row this invite *created* when seeding /people (null when it
	// adopted an existing member, or no name was given). Lets revoke/expiry
	// cleanup archive the provisional person without touching real members. No FK
	// — mirrors app_user.person_id; people may be soft-deleted out from under it.
	personId: integer("person_id"),
	roleId: integer("role_id").notNull(),
	// Committee the invitee is assigned to — applied to their People record on
	// acceptance. Optional; mirrors people.committee.
	committee: varchar({ length: 128 }),
	// The invitee's position / title (e.g. "Events Lead") — applied to their
	// People record (seeded now or on acceptance). Optional; mirrors
	// people.role_title. Distinct from role_id, which is the RBAC role.
	roleTitle: varchar("role_title", { length: 128 }),
	// sha-256 of the raw invite token; the raw token is only ever in the link.
	tokenHash: varchar("token_hash", { length: 128 }).notNull(),
	// pending | accepted | revoked
	status: varchar({ length: 16 }).default('pending').notNull(),
	invitedBy: varchar("invited_by", { length: 256 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	uniqueIndex("ix_app_invite_token_hash").using("btree", table.tokenHash.asc().nullsLast().op("text_ops")),
	index("ix_app_invite_email").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("ix_app_invite_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.roleId],
			foreignColumns: [appRole.id],
			name: "app_invite_role_id_fkey"
		}),
]);

// --- Committees (app-owned controlled vocabulary, created via
// `scripts/create-committee-table.ts`, NOT by Alembic). The canonical source of
// truth for the club's committees + their properties. Records elsewhere
// (people/events/tasks/boards/invites) still store the committee *name* as a
// string; this table holds the editable list and metadata. Renames cascade to
// those name strings — see `admin/committees/actions.ts`. ---

export const committee = pgTable("committee", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 128 }).notNull(),
	// Badge/accent colour (hex, e.g. "#e91e63"); null falls back to a neutral dot.
	color: varchar({ length: 16 }),
	description: text(),
	// Optional committee lead — a roster record. SET NULL on person delete so
	// deleting a person never fails on this reference (mirrors the migration DDL).
	leadPersonId: integer("lead_person_id"),
	// Inactive committees are hidden from pickers but keep their historical data.
	isActive: boolean("is_active").default(true).notNull(),
	sortOrder: integer("sort_order").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("ix_committee_name").using("btree", sql`lower(${table.name})`),
	index("ix_committee_is_active").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	index("ix_committee_sort_order").using("btree", table.sortOrder.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.leadPersonId],
			foreignColumns: [people.id],
			name: "committee_lead_person_id_fkey"
		}).onDelete("set null"),
]);

// --- App-owned site settings (simple key/value store). Created via
// `scripts/setup-settings.ts`, NOT by Alembic. Holds global config such as the
// public social links that admins edit from the Settings page. ---

export const appSetting = pgTable("app_setting", {
	key: varchar({ length: 128 }).primaryKey().notNull(),
	value: text(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

// --- Sponsor packages (public-facing tier definitions, managed by dsec-app,
// served by dsec-api at /website/sponsor-packages). Schema owned by Alembic. ---

export const sponsorPackages = pgTable("sponsor_package", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 64 }).notNull(),
	pitch: varchar({ length: 512 }),
	price: varchar({ length: 64 }),
	includes: json().$type<string[]>(),
	featured: boolean().default(false).notNull(),
	isVisible: boolean("is_visible").default(true).notNull(),
	displayOrder: integer("display_order").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ix_sponsor_package_is_visible").using("btree", table.isVisible.asc().nullsLast().op("bool_ops")),
]);

// --- Sponsor leads (inbound enquiries from dsec-website forms + Cal.com
// bookings). Schema owned by Alembic. ---

export const sponsorLeads = pgTable("sponsor_lead", {
	id: serial().primaryKey().notNull(),
	// pricing_unlock | enquiry | cal_booking
	source: varchar({ length: 32 }).notNull(),
	tier: varchar({ length: 64 }),
	name: varchar({ length: 256 }),
	email: varchar({ length: 256 }).notNull(),
	company: varchar({ length: 256 }),
	phone: varchar({ length: 64 }),
	budget: varchar({ length: 64 }),
	message: text(),
	// new | contacted | converted | closed
	status: varchar({ length: 16 }).default('new').notNull(),
	notes: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ix_sponsor_lead_email").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("ix_sponsor_lead_source").using("btree", table.source.asc().nullsLast().op("text_ops")),
	index("ix_sponsor_lead_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("ix_sponsor_lead_created_at").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
]);

// --- DUSA roster (read-only mirror; owned by dsec-api's weekly ingest). The
// member portal verifies a login by matching its email against a CURRENT row
// here. The hub reads it only to show a "matched member" hint in Member Support.
// Declared with just the columns the hub reads. ---

export const members = pgTable("members", {
	id: serial().primaryKey().notNull(),
	studentId: varchar("student_id", { length: 32 }).notNull(),
	fullName: varchar("full_name", { length: 256 }),
	email: varchar({ length: 256 }),
	dusaMember: boolean("dusa_member").default(false).notNull(),
	endDate: date("end_date", { mode: 'string' }),
	isCurrent: boolean("is_current").default(true).notNull(),
});

// --- Member portal account (app-owned by dsec-app; created via that app's
// `scripts/add-portal-account-table.ts`, NOT Alembic). One row per portal login
// (OAuth identity + DUSA-membership lifecycle). The hub's Member Support view
// reads these and writes `manual_override` to approve/reject access. ---

export const portalAccount = pgTable("portal_account", {
	id: serial().primaryKey().notNull(),
	email: varchar({ length: 256 }).notNull(),
	name: varchar({ length: 256 }),
	avatarUrl: text("avatar_url"),
	provider: varchar({ length: 32 }),
	providerAccountId: varchar("provider_account_id", { length: 256 }),
	// trial | verified | lapsed | locked | rejected (snapshot; portal recomputes live)
	status: varchar({ length: 24 }).default('trial').notNull(),
	trialStartedAt: timestamp("trial_started_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	trialExpiresAt: timestamp("trial_expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	verifiedAt: timestamp("verified_at", { withTimezone: true, mode: 'string' }),
	lastMatchedAt: timestamp("last_matched_at", { withTimezone: true, mode: 'string' }),
	memberId: integer("member_id"),
	lastCheckAt: timestamp("last_check_at", { withTimezone: true, mode: 'string' }),
	// null | 'approved' | 'rejected' — committee decision, wins over auto-resolution.
	manualOverride: varchar("manual_override", { length: 16 }),
	overrideBy: varchar("override_by", { length: 256 }),
	overrideNote: text("override_note"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("ix_portal_account_email").using("btree", table.email.asc().nullsLast()),
	index("ix_portal_account_status").using("btree", table.status.asc().nullsLast()),
	index("ix_portal_account_member_id").using("btree", table.memberId.asc().nullsLast()),
]);

// --- Member assistance / verification requests (app-owned by dsec-app). The
// hub's Member Support queue lists and resolves these. ---

export const assistanceRequest = pgTable("assistance_request", {
	id: serial().primaryKey().notNull(),
	portalAccountId: integer("portal_account_id"),
	email: varchar({ length: 256 }).notNull(),
	contactEmail: varchar("contact_email", { length: 256 }),
	studentId: varchar("student_id", { length: 32 }),
	category: varchar({ length: 32 }).default('verification').notNull(),
	message: text().notNull(),
	// open | resolved | dismissed
	status: varchar({ length: 16 }).default('open').notNull(),
	resolutionNote: text("resolution_note"),
	resolvedBy: varchar("resolved_by", { length: 256 }),
	resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("ix_assistance_request_status").using("btree", table.status.asc().nullsLast()),
	index("ix_assistance_request_email").using("btree", table.email.asc().nullsLast()),
]);

// --- Per-user notification preferences (app-owned by dsec-hub; created via
// `scripts/add-notification-tables.ts`, NOT by Alembic). One row per login user.
// A missing row means "all defaults" (see DEFAULT_PREFS in lib/notifications) —
// the row is created lazily on first save. Drives the on-assign + due-soon
// notifications across Email / Discord / Telegram. ---

export const notificationPref = pgTable("notification_pref", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	// Channels — each has an enable flag plus the connection detail it needs.
	emailEnabled: boolean("email_enabled").default(true).notNull(),
	// Null ⇒ deliver to the account email (app_user.email).
	emailAddress: varchar("email_address", { length: 256 }),
	discordEnabled: boolean("discord_enabled").default(false).notNull(),
	discordWebhookUrl: text("discord_webhook_url"),
	telegramEnabled: boolean("telegram_enabled").default(false).notNull(),
	telegramChatId: varchar("telegram_chat_id", { length: 32 }),
	// Short-lived code embedded in the t.me deep link; the webhook matches it to
	// claim the chat, then clears it.
	telegramLinkCode: varchar("telegram_link_code", { length: 32 }),
	telegramLinkedAt: timestamp("telegram_linked_at", { withTimezone: true, mode: 'string' }),
	// Categories the user can mute independently.
	notifyOnAssign: boolean("notify_on_assign").default(true).notNull(),
	notifyDueDigest: boolean("notify_due_digest").default(true).notNull(),
	notifyDueReminder: boolean("notify_due_reminder").default(true).notNull(),
	// Tuning: digest horizon (tasks due within N days) + reminder lead time.
	dueSoonDays: integer("due_soon_days").default(3).notNull(),
	reminderLeadDays: integer("reminder_lead_days").default(1).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("ix_notification_pref_user_id").using("btree", table.userId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [appUser.id],
			name: "notification_pref_user_id_fkey"
		}).onDelete("cascade"),
]);

// --- Notification audit + dedupe guard (app-owned; created via
// `scripts/add-notification-tables.ts`). Every send attempt writes one row; the
// UNIQUE `dedupe_key` lets the daily cron re-run idempotently (a digest/reminder
// already sent for a (user, task, due-date, channel) is skipped). ---

export const notificationLog = pgTable("notification_log", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id").notNull(),
	// email | discord | telegram
	channel: varchar({ length: 16 }).notNull(),
	// task_assigned | due_digest | due_reminder
	kind: varchar({ length: 32 }).notNull(),
	taskId: integer("task_id"),
	dedupeKey: varchar("dedupe_key", { length: 256 }).notNull(),
	// sent | failed | skipped
	status: varchar({ length: 16 }).notNull(),
	detail: varchar({ length: 512 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("ix_notification_log_dedupe_key").using("btree", table.dedupeKey.asc().nullsLast().op("text_ops")),
	index("ix_notification_log_user_id").using("btree", table.userId.asc().nullsLast().op("int4_ops")),
]);
