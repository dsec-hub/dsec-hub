/**
 * Single source of truth for the dashboard's section catalog and each role's
 * default "Focus" config (ViewConfig). PURE + edge-safe: type-only imports, no
 * DB, no server code — safe to import from the DAL, the admin role form, the
 * dashboard page, and edge code.
 *
 * KEEP IN SYNC with `scripts/setup-roles-v2.ts` (which inlines the same role
 * defaults as raw values, since migration scripts can't import from `@/`).
 */
import type { ViewConfig } from "@/db/schema";
import type { ModuleKey } from "@/lib/rbac";

/** A dashboard section the role's viewConfig can toggle on/off. */
export type DashboardSection = {
  id: string;
  label: string;
  description: string;
  /** Module required to SEE this section (defense-in-depth; Focus never widens). */
  module: ModuleKey;
};

/**
 * Canonical dashboard sections. The `id`s are the keys used in
 * `ViewConfig.sections`. Adding a section here makes it available in the admin
 * role editor automatically.
 */
export const CANONICAL_SECTIONS: readonly DashboardSection[] = [
  { id: "my_work", label: "My Work", description: "Tasks assigned to you, grouped by due date.", module: "tasks" },
  { id: "tasks_due_soon", label: "Tasks due soon", description: "Everything due in the next two weeks.", module: "tasks" },
  { id: "action_items", label: "Action items", description: "Open follow-ups from recent meetings.", module: "meetings" },
  { id: "upcoming_events", label: "Upcoming events", description: "The next events on the calendar.", module: "events" },
  { id: "upcoming_meetings", label: "Upcoming meetings", description: "The next scheduled meetings.", module: "meetings" },
  { id: "active_projects", label: "Active projects", description: "In-flight community projects + status.", module: "projects" },
  { id: "sponsor_pipeline", label: "Sponsor pipeline", description: "Deals by stage + next steps.", module: "sponsors" },
  { id: "partners", label: "Partner orgs", description: "Collaborator clubs + their linked events.", module: "partners" },
  { id: "committee_health", label: "Committee health", description: "Per-committee open/overdue tasks + lead.", module: "tasks" },
  { id: "membership", label: "Membership", description: "Member count + DUSA trend.", module: "members" },
  { id: "finance_summary", label: "Finance summary", description: "Balance, income, expenses.", module: "finance" },
  { id: "expense_breakdown", label: "Expense breakdown", description: "Spending by category.", module: "finance" },
  { id: "event_budgets", label: "Event budgets", description: "Allocated vs spent per event.", module: "finance" },
  { id: "recent_documents", label: "Recent documents", description: "Recently updated docs + meeting notes.", module: "documents" },
] as const;

export const CANONICAL_SECTION_IDS: readonly string[] = CANONICAL_SECTIONS.map((s) => s.id);

/** Build a sections map (id -> true) from a visible-id list. */
function sectionsFrom(ids: string[]): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const id of ids) out[id] = true;
  return out;
}

function vc(landingPath: string, sectionIds: string[], defaultTaskView: string): ViewConfig {
  return { version: 1, sections: sectionsFrom(sectionIds), landingPath, defaultTaskView };
}

/**
 * Per-role default Focus config, keyed by lower-cased role name. Each is the
 * dashboard a designed PERSONA needs to see first (see ROLE_PERSONAS below +
 * PERSONAS.md). Section ids are listed in CANONICAL_SECTIONS order; the page
 * renders that order regardless, so a role is just a subset. Unknown roles fall
 * back to GENERIC_DEFAULT.
 *
 * KEEP IN SYNC with `scripts/setup-roles-v2.ts` (new installs) and
 * `scripts/apply-role-dashboards.ts` (re-applies these to live roles).
 */
const GENERIC_DEFAULT: ViewConfig = vc("/dashboard", ["my_work", "upcoming_events"], "my-work");

const ROLE_DEFAULTS: Record<string, ViewConfig> = {
  // Oversight execs — broad, club-wide, land on their composed dashboard.
  admin: vc("/dashboard", ["tasks_due_soon", "upcoming_events", "sponsor_pipeline", "committee_health", "finance_summary"], "all-tasks"),
  exec: vc("/dashboard", ["my_work", "upcoming_events", "sponsor_pipeline", "committee_health", "finance_summary"], "by-committee"),
  // Governance.
  secretary: vc("/meetings", ["my_work", "action_items", "upcoming_meetings", "recent_documents"], "my-work"),
  // External affairs — pipeline + partners.
  "external affairs lead": vc("/dashboard", ["my_work", "action_items", "upcoming_events", "sponsor_pipeline", "partners"], "by-committee"),
  "external affairs member": vc("/dashboard", ["my_work", "action_items", "upcoming_meetings", "sponsor_pipeline", "partners"], "my-work"),
  // Marketing — promo against the event calendar.
  "marketing lead": vc("/dashboard", ["my_work", "tasks_due_soon", "action_items", "upcoming_events", "committee_health"], "by-committee"),
  "marketing member": vc("/dashboard", ["my_work", "action_items", "upcoming_events", "upcoming_meetings"], "my-work"),
  // Design — assets against the event calendar.
  "design lead": vc("/dashboard", ["my_work", "action_items", "upcoming_events", "committee_health", "recent_documents"], "by-committee"),
  "design member": vc("/tasks", ["my_work", "action_items", "upcoming_events", "upcoming_meetings"], "my-work"),
  // Development — projects + tech.
  "development lead": vc("/dashboard", ["my_work", "action_items", "upcoming_meetings", "active_projects", "committee_health"], "by-committee"),
  "development member": vc("/projects", ["my_work", "upcoming_events", "upcoming_meetings", "active_projects"], "my-work"),
  // Base.
  "general member": vc("/tasks", ["my_work", "upcoming_events", "upcoming_meetings"], "my-work"),
  // Finance.
  treasurer: vc("/finance", ["finance_summary", "expense_breakdown", "event_budgets"], "my-work"),
  auditor: vc("/finance", ["my_work", "sponsor_pipeline", "finance_summary", "expense_breakdown", "event_budgets"], "by-committee"),
  // Holding pattern — no modules; renders the welcome/placement shell.
  viewer: vc("/dashboard", [], "my-work"),
};

/** A role's persona — who sits in this seat, for PERSONAS.md + in-product copy. */
export type RolePersona = {
  archetype: string;
  oneLiner: string;
  persona: string;
  topQuestions: string[];
};

/**
 * Per-role personas (lower-cased role name). The "why" behind each dashboard in
 * ROLE_DEFAULTS — surfaced in the admin role editor and the "View as" switcher,
 * and the source for PERSONAS.md.
 */
export const ROLE_PERSONAS: Record<string, RolePersona> = {
  admin: {
    archetype: "The Club President",
    oneLiner: "Owns the whole club's health, finances, and reputation — ultimately accountable for everything that ships or slips.",
    persona: "The most senior person in the committee and DSEC's single accountable owner, holding every key but focused on governance rather than doing the work. A typical week is chairing the exec meeting, unblocking leads who are behind, signing off budgets and sponsor deals, and being the face the university and sponsors talk to. They sweep across every committee scanning for what's slipping, then drill into the one that needs them.",
    topQuestions: [
      "Which committee is behind or has overdue work, and who do I chase?",
      "What's due across the whole club in the next two weeks that could embarrass us if it slips?",
      "What's on the calendar that I need to show up to or be accountable for?",
      "Are we solvent right now, and how is the balance trending?",
      "Is the sponsorship pipeline healthy, and is any deal stuck and needing my push?",
    ],
  },
  exec: {
    archetype: "The Air-Traffic Controller",
    oneLiner: "The VP / operational deputy — owns nothing single-handedly but is accountable for everything moving.",
    persona: "A senior elected officer, second only to the President, with a cross-club mandate and full read/write on every operational module. Most of their week is spent scanning across committees, prepping the weekly exec meeting, and chasing the two or three things at risk. They drop into a committee's tasks to see why a lead is behind, nudge a stalled deal, sanity-check that an event is staffed and on-budget, and glance at the balance before approving spend.",
    topQuestions: [
      "Which committee is falling behind or has overdue tasks — and who do I chase?",
      "What events are coming up, and is the club actually ready for them?",
      "Where do our sponsorship deals stand and which need a push this week?",
      "Are we financially healthy — what's the balance and how's money flowing?",
      "What's personally on my plate / what exec decisions need follow-through?",
    ],
  },
  secretary: {
    archetype: "The Minute-Keeper",
    oneLiner: "The club's record-keeper and meeting steward — schedules meetings, captures minutes, and chases the action items.",
    persona: "A trusted, detail-oriented member who keeps governance running across every committee, holding the institutional memory of agendas, minutes, and the shared document library. Their week orbits the meeting cycle: drafting agendas, taking minutes, writing up notes, and logging open action items. Between meetings they file and tidy documents and chase outstanding follow-ups so commitments don't slip.",
    topQuestions: [
      "What meetings are coming up, and which still need an agenda or notice?",
      "Which action items from recent meetings are still open, and who owns them?",
      "Have the latest minutes been written up and filed where people can find them?",
      "What do I personally owe this week — circulate minutes, book a room, share an agenda?",
    ],
  },
  "external affairs lead": {
    archetype: "The Deal-Closer",
    oneLiner: "Brings in the money and the allies — owns every sponsor deal and partner-club relationship end to end.",
    persona: "A senior committee lead responsible for DSEC's external revenue and relationships, running External Affairs to chase sponsorship cash, in-kind support, and co-hosting deals. Most of their week is outreach — sending decks, chasing replies, nudging deals from 'contacted' to 'signed' — while delegating follow-ups. They coordinate with events so every sponsor logo, booth, and partner obligation lands on the right event.",
    topQuestions: [
      "Which sponsor deals are in play, what stage is each at, and what's the next step?",
      "What follow-ups and tasks are on me or my committee this week?",
      "Which partner clubs are we working with, and which events are they tied to?",
      "What's coming up that has sponsor or partner deliverables to fulfil?",
      "What did we commit to in recent meetings that's still open?",
    ],
  },
  "external affairs member": {
    archetype: "The Pipeline Worker",
    oneLiner: "Owns a slice of the sponsor pipeline and partner relationships, chasing deals from first email to signed package.",
    persona: "An individual contributor on External Affairs who owns a handful of sponsor accounts end to end and keeps partner clubs warm, taking direction from the lead. Their week is outreach: drafting sponsor emails, logging contacts, advancing deal stages, and prepping decks for partner clubs. They live in /sponsors and /partners, and walk out of the weekly meeting with follow-ups to action.",
    topQuestions: [
      "Which of my sponsor deals are stuck and what's the next step on each?",
      "What follow-ups and outreach tasks are assigned to me right now?",
      "Which partner orgs are active and what events are they linked to?",
      "What did I commit to in the last committee meeting that's still open?",
      "When is our next External Affairs meeting and what should I prep?",
    ],
  },
  "marketing lead": {
    archetype: "The Hype Engine",
    oneLiner: "Owns how DSEC shows up to campus — event promo, social content, and the club's voice through a small crew.",
    persona: "A committee-level lead accountable for turnout and the club's public presence, directing a marketing/design crew and reporting up to Exec. Each week they reverse-engineer a promo plan from the event calendar, assigning captions, graphics, and reels and chasing the assets that must ship before each event date. They run a short standup, capture who-owns-what, and personally write the highest-stakes posts.",
    topQuestions: [
      "What events are coming up, and is our promo plan far enough ahead of each date?",
      "Is my marketing team behind on anything — what's overdue right now?",
      "What promo assets are on MY plate to ship this week?",
      "What did we commit to in the last committee meeting, and is it moving?",
      "What's landing across the club in the next two weeks that we need to promote?",
    ],
  },
  "marketing member": {
    archetype: "The Hype Builder",
    oneLiner: "Turns the club's upcoming events into posters, captions, and social posts — one assigned task at a time.",
    persona: "A rank-and-file marketing member, usually a first- or second-year, who executes promo work rather than running the committee. In a typical week they pull their assigned design/copy tasks, scan the event calendar to see what needs promoting next, and build the graphics with enough lead time. They attend the weekly standup and ship content against deadlines.",
    topQuestions: [
      "What marketing tasks are assigned to me, and which is due first?",
      "Which events are coming up that I need to create promo for, and how much lead time?",
      "What follow-ups did I pick up from the last marketing meeting?",
      "When is our next committee meeting?",
    ],
  },
  "design lead": {
    archetype: "The Asset Marshal",
    oneLiner: "Runs the design team and owns every visual the club ships — posters, banners, and brand consistency, on time.",
    persona: "A senior student creative who heads Design, splitting time between hands-on production and delegating to junior designers, accountable for every visual the club ships. They triage incoming requests against the event calendar, break them into tasks, and produce the hero art themselves. They review drafts, keep briefs and brand assets organized in shared docs, and chase the tightest-lead-time deliverables.",
    topQuestions: [
      "What design deliverables do I personally owe right now, and what's due next?",
      "Which upcoming events still need assets — and do we have lead time to make them?",
      "Is my design team on track, or is anything overdue or stuck?",
      "What design follow-ups came out of our last meeting?",
      "Where's the latest brief, brand guide, or set of meeting notes I need?",
    ],
  },
  "design member": {
    archetype: "The Asset Crafter",
    oneLiner: "Turns event briefs into posters, social assets, and branding on deadline.",
    persona: "A hands-on creative on the Design committee who executes rather than oversees — taking a brief and shipping the artwork by the date it's needed. Most of their week is heads-down production against a short list of assigned tasks, each tied to a real event date. They check the calendar to confirm deadlines and pick up revision notes from the last crit.",
    topQuestions: [
      "What design tasks are assigned to me and which are due first?",
      "Which events are coming up, so I know the real deadline behind each asset?",
      "Did any revisions or follow-ups land on me from the last design crit?",
      "When is the next Design meeting or review I need to show up to?",
    ],
  },
  "development lead": {
    archetype: "The Build Captain",
    oneLiner: "Steers DSEC's in-flight build projects from idea to demo, keeping the dev team unblocked and shipping.",
    persona: "A senior student who heads Development — the team that designs and builds DSEC's community and technical projects — owning the roadmap and answering to Exec for on-time delivery. Their week is triaging project boards, breaking work into tasks and assigning them, and running a weekly build sync. They update project status, capture action items, and watch for anything drifting overdue while staying hands-on.",
    topQuestions: [
      "Which of my projects are on track, and which are stalled or blocked?",
      "Does anyone on my dev team have overdue or piled-up tasks I need to rebalance?",
      "What do I personally owe this week?",
      "What's our next build sync, and who's expected?",
      "What follow-ups from the last meeting still aren't done?",
    ],
  },
  "development member": {
    archetype: "The Hands-On Builder",
    oneLiner: "Builds and ships the club's community/engineering projects and owns their slice of the backlog.",
    persona: "An individual contributor on Development — typically a student engineer assigned to one or two in-flight projects — whose mandate is execution: take a project task and ship it. Their week is in /projects updating the status of a project they own, ticking off assigned tasks, and prepping a build for an upcoming demo. They show up to the dev sync to unblock.",
    topQuestions: [
      "Which of my projects are in flight right now and what status is each in?",
      "What tasks are assigned to me, and what's due next?",
      "Which event or demo am I building toward, and when does it land?",
      "When is the next Development sync I need to show up for?",
    ],
  },
  "general member": {
    archetype: "The Reliable Doer",
    oneLiner: "Shows up, takes the tasks handed to them, and helps run events — owns their own to-do list and nothing more.",
    persona: "A student volunteer on a committee (or club-wide) with no management remit — the broad base that executes the work leads delegate, with authority stopping at their own assigned tasks. They log in to see what's been assigned, tick tasks off, and confirm the time and place of their next meeting. Around events they're hands-on — setup, registration desk, running a station.",
    topQuestions: [
      "What's on my plate right now, and what's due first?",
      "When and where is my next committee meeting so I don't miss it?",
      "What events are coming up that I'm expected to help run or attend?",
      "Of my tasks, is anything overdue or due this week?",
    ],
  },
  treasurer: {
    archetype: "The Ledger-Keeper",
    oneLiner: "The single owner of the club's money — tracks the balance, records spending, and keeps every event on budget.",
    persona: "An elected officer personally accountable for DSEC's finances to the exec and to DUSA, with a narrow but deep mandate: one module, finance, with full read and write. They reconcile new transactions, log reimbursements tied to recent events, and answer spend questions from leads. Around events they set and watch budgets; at exec meetings they report the running balance and flag overspend.",
    topQuestions: [
      "What's our current balance, and how do income and expenses sit this period?",
      "Is any event over (or close to) its allocated budget right now?",
      "Where is the money actually going — which categories are growing?",
      "Are there recent expenses I still need to record or reconcile?",
      "Can I give the exec an accurate financial snapshot for the next meeting?",
    ],
  },
  auditor: {
    archetype: "The Books-Balancer",
    oneLiner: "The independent financial watchdog — verifies every dollar in and out and checks spend against the approved budget.",
    persona: "A senior, trusted student elected to keep the committee financially honest, sitting outside the day-to-day operating roles to provide independent oversight before anything reaches the AGM or DUSA. They reconcile transactions, compare each event's spend against budget, and check that booked sponsor income has landed. They rarely change anything — they read across every committee and write up findings as their own audit tasks.",
    topQuestions: [
      "What's our current balance, and is income keeping pace with expenses?",
      "Is any event over its allocated budget right now?",
      "Where is the money actually going — which categories dominate?",
      "Has the sponsor income we booked actually come through?",
      "What audit reviews or sign-offs do I owe before the next meeting?",
    ],
  },
  viewer: {
    archetype: "The Newcomer",
    oneLiner: "A freshly-onboarded, not-yet-placed member — owns nothing yet and is waiting to be slotted into a committee.",
    persona: "The lowest-privilege seat: a brand-new or unassigned member who has finished onboarding but hasn't been given a committee or any module access. They log in once or twice to check whether anyone has assigned them a starter task and to look for a signal about which committee they'll join. Their time in the workspace is a holding pattern until an admin grants access.",
    topQuestions: [
      "Has anyone assigned me a task yet, and is there anything I should start on?",
      "Which committee am I being placed in, and who is the lead I should contact?",
      "Is my access still being provisioned, or did onboarding not fully complete?",
      "Who do I ping to get upgraded into a real role with actual access?",
    ],
  },
};

/** The persona for a role name (case-insensitive), or null if none defined. */
export function getRolePersona(roleName: string | null | undefined): RolePersona | null {
  return roleName ? ROLE_PERSONAS[roleName.toLowerCase()] ?? null : null;
}

// Roles that see EVERY committee's meetings/notes; everyone else is scoped to
// their own committee (+ club-wide). Keyed by lower-cased role name.
const ALL_COMMITTEE_ROLES = new Set(["admin", "exec", "secretary", "auditor"]);

export function defaultCommitteeScope(roleName: string | null | undefined): "all" | "own" {
  return ALL_COMMITTEE_ROLES.has((roleName ?? "").toLowerCase()) ? "all" : "own";
}

/** The default Focus config for a role name (case-insensitive). */
export function getDefaultViewConfig(roleName: string | null | undefined): ViewConfig {
  const base = roleName ? ROLE_DEFAULTS[roleName.toLowerCase()] ?? GENERIC_DEFAULT : GENERIC_DEFAULT;
  return { ...base, committeeScope: defaultCommitteeScope(roleName) };
}

/**
 * Normalise a possibly-null / legacy viewConfig into a complete one, merging in
 * the role default for any missing piece. The DAL calls this so consumers never
 * see a null or half-shaped config.
 */
export function normalizeViewConfig(raw: ViewConfig | null | undefined, roleName: string | null | undefined): ViewConfig {
  const fallback = getDefaultViewConfig(roleName);
  if (!raw || typeof raw !== "object") return fallback;
  const hasSections = raw.sections && typeof raw.sections === "object" && Object.keys(raw.sections).length > 0;
  return {
    version: 1,
    sections: hasSections ? raw.sections : fallback.sections,
    landingPath: raw.landingPath ?? fallback.landingPath,
    defaultTaskView: raw.defaultTaskView ?? fallback.defaultTaskView,
    navOrder: raw.navOrder ?? fallback.navOrder,
    committeeScope: raw.committeeScope ?? fallback.committeeScope,
  };
}

/** The set of section ids a role's viewConfig has switched on. */
export function visibleSections(viewConfig: ViewConfig): Set<string> {
  const out = new Set<string>();
  for (const [id, on] of Object.entries(viewConfig.sections ?? {})) {
    if (on) out.add(id);
  }
  return out;
}
