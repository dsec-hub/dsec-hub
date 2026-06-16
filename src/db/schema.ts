import { pgTable, varchar, index, serial, timestamp, json, text, integer, doublePrecision, uniqueIndex, boolean, foreignKey, unique, date, time, numeric } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



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
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	archived: boolean().default(false).notNull(),
}, (table) => [
	index("ix_events_archived").using("btree", table.archived.asc().nullsLast().op("bool_ops")),
	index("ix_events_is_public").using("btree", table.isPublic.asc().nullsLast().op("bool_ops")),
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

export const appRole = pgTable("app_role", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 64 }).notNull(),
	description: varchar({ length: 256 }),
	// JSON array of module keys, e.g. ["events","finance"]. "admin" = full access.
	modules: json().$type<string[]>().default([]).notNull(),
	// Subset of `modules` this role may also EDIT (write ⊆ read). Modules in
	// `modules` but not here are view-only. "admin" implies write everywhere.
	writeModules: json("write_modules").$type<string[]>().default([]).notNull(),
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

export const appInvite = pgTable("app_invite", {
	id: serial().primaryKey().notNull(),
	email: varchar({ length: 256 }).notNull(),
	roleId: integer("role_id").notNull(),
	// Committee the invitee is assigned to — applied to their People record on
	// acceptance. Optional; mirrors people.committee.
	committee: varchar({ length: 128 }),
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
