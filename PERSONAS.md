# Role Personas & Dashboard Views

Every DSEC role is built around a **persona** — the real human in that seat, what
their week looks like, and the handful of questions they open the hub to answer.
Each persona drives a **dashboard view**: where they land, their default task
view, their committee scope, and exactly which dashboard sections they see first.

This doc is the "why". The machine-readable source of truth lives in
`src/lib/dashboard-config.ts` (`ROLE_PERSONAS` + `ROLE_DEFAULTS`), is seeded for
new installs by `scripts/setup-roles-v2.ts`, and is applied/restored to live
roles by `scripts/apply-role-dashboards.ts`.

> **Access vs Focus.** A persona's dashboard is presentation only — it narrows
> what a role sees first. It can never grant access beyond the modules the role
> is granted (`ROLES.md`). Every dashboard section is still hard-gated by the
> viewer's real module access.

## Dashboard sections

The dashboard is composed from a fixed catalogue, rendered top-to-bottom in this
order; each role enables a subset:

| Section | Needs module | Shows |
|---|---|---|
| My Work | tasks | Tasks assigned to you, by due date |
| Tasks due soon | tasks | Everything club-wide due in 2 weeks |
| Action items | meetings | Open follow-ups from recent meetings |
| Upcoming events | events | The next events on the calendar |
| Upcoming meetings | meetings | The next scheduled meetings (scoped) |
| Active projects | projects | In-flight community projects + status |
| Sponsor pipeline | sponsors | Deals by stage + next steps |
| Partner orgs | partners | Collaborator clubs + linked events |
| Committee health | tasks | Per-committee open/overdue + lead |
| Membership | members | Member count + DUSA growth trend |
| Finance summary | finance | Balance, income, expenses |
| Expense breakdown | finance | Spending by category |
| Event budgets | finance | Allocated vs spent per event |
| Recent documents | documents | Recently updated docs + notes |

## At a glance

| Role | Persona | Lands on | Task view | Scope | Dashboard sections |
|---|---|---|---|---|---|
| Admin | The Club President | /dashboard | All Tasks | all | Tasks due soon · Upcoming events · Sponsor pipeline · Committee health · Finance summary |
| Exec | The Air-Traffic Controller | /dashboard | By Committee | all | My Work · Upcoming events · Sponsor pipeline · Committee health · Finance summary |
| Secretary | The Minute-Keeper | /meetings | My Work | all | My Work · Action items · Upcoming meetings · Recent documents |
| External Affairs Lead | The Deal-Closer | /dashboard | By Committee | own | My Work · Action items · Upcoming events · Sponsor pipeline · Partner orgs |
| External Affairs Member | The Pipeline Worker | /dashboard | My Work | own | My Work · Action items · Upcoming meetings · Sponsor pipeline · Partner orgs |
| Marketing Lead | The Hype Engine | /dashboard | By Committee | own | My Work · Tasks due soon · Action items · Upcoming events · Committee health |
| Marketing Member | The Hype Builder | /dashboard | My Work | own | My Work · Action items · Upcoming events · Upcoming meetings |
| Design Lead | The Asset Marshal | /dashboard | By Committee | own | My Work · Action items · Upcoming events · Committee health · Recent documents |
| Design Member | The Asset Crafter | /tasks | My Work | own | My Work · Action items · Upcoming events · Upcoming meetings |
| Development Lead | The Build Captain | /dashboard | By Committee | own | My Work · Action items · Upcoming meetings · Active projects · Committee health |
| Development Member | The Hands-On Builder | /projects | My Work | own | My Work · Upcoming events · Upcoming meetings · Active projects |
| General Member | The Reliable Doer | /tasks | My Work | own | My Work · Upcoming events · Upcoming meetings |
| Treasurer | The Ledger-Keeper | /finance | My Work | own | Finance summary · Expense breakdown · Event budgets |
| Auditor | The Books-Balancer | /finance | By Committee | all | My Work · Sponsor pipeline · Finance summary · Expense breakdown · Event budgets |
| Viewer | The Newcomer | /dashboard | My Work | own | *(welcome / placement shell — no modules yet)* |

---

## Admin — *The Club President*

> Owns the whole club's health, finances, and reputation — ultimately
> accountable for everything that ships or slips.

The most senior person in the committee and DSEC's single accountable owner,
holding every key but focused on governance rather than doing the work. A typical
week is chairing the exec meeting, unblocking leads who are behind, signing off
budgets and sponsor deals, and being the face the university and sponsors talk
to. They sweep across every committee scanning for what's slipping, then drill
into the one that needs them.

**Opens the dashboard to ask:**
- Which committee is behind or has overdue work, and who do I chase?
- What's due across the whole club in the next two weeks that could embarrass us?
- What's on the calendar that I need to show up to or be accountable for?
- Are we solvent right now, and how is the balance trending?
- Is the sponsorship pipeline healthy, and is any deal stuck and needing my push?

## Exec — *The Air-Traffic Controller*

> The VP / operational deputy — owns nothing single-handedly but is accountable
> for everything moving.

A senior elected officer, second only to the President, with a cross-club mandate
and full read/write on every operational module. Most of their week is scanning
across committees, prepping the weekly exec meeting, and chasing the two or three
things at risk. They drop into a committee's tasks to see why a lead is behind,
nudge a stalled deal, sanity-check that an event is staffed and on-budget, and
glance at the balance before approving spend.

**Opens the dashboard to ask:**
- Which committee is falling behind or has overdue tasks — and who do I chase?
- What events are coming up, and is the club actually ready for them?
- Where do our sponsorship deals stand and which need a push this week?
- Are we financially healthy — what's the balance and how's money flowing?
- What's personally on my plate / what exec decisions need follow-through?

## Secretary — *The Minute-Keeper*

> The club's record-keeper and meeting steward — schedules meetings, captures
> minutes, and chases the action items.

A trusted, detail-oriented member who keeps governance running across every
committee, holding the institutional memory of agendas, minutes, and the shared
document library. Their week orbits the meeting cycle: drafting agendas, taking
minutes, writing up notes, and logging open action items. Between meetings they
file and tidy documents and chase outstanding follow-ups so commitments don't
slip.

**Opens the dashboard to ask:**
- What meetings are coming up, and which still need an agenda or notice?
- Which action items from recent meetings are still open, and who owns them?
- Have the latest minutes been written up and filed where people can find them?
- What do I personally owe this week — circulate minutes, book a room?

## External Affairs Lead — *The Deal-Closer*

> Brings in the money and the allies — owns every sponsor deal and partner-club
> relationship end to end.

A senior committee lead responsible for DSEC's external revenue and
relationships, running External Affairs to chase sponsorship cash, in-kind
support, and co-hosting deals. Most of their week is outreach — sending decks,
chasing replies, nudging deals from "contacted" to "signed" — while delegating
follow-ups. They coordinate with events so every sponsor logo, booth, and partner
obligation lands on the right event.

**Opens the dashboard to ask:**
- Which sponsor deals are in play, what stage is each at, and what's next?
- What follow-ups and tasks are on me or my committee this week?
- Which partner clubs are we working with, and which events are they tied to?
- What's coming up that has sponsor or partner deliverables to fulfil?
- What did we commit to in recent meetings that's still open?

## External Affairs Member — *The Pipeline Worker*

> Owns a slice of the sponsor pipeline and partner relationships, chasing deals
> from first email to signed package.

An individual contributor who owns a handful of sponsor accounts end to end and
keeps partner clubs warm, taking direction from the lead. Their week is outreach:
drafting sponsor emails, logging contacts, advancing deal stages, and prepping
decks for partner clubs. They live in /sponsors and /partners, and walk out of
the weekly meeting with follow-ups to action.

**Opens the dashboard to ask:**
- Which of my sponsor deals are stuck and what's the next step on each?
- What follow-ups and outreach tasks are assigned to me right now?
- Which partner orgs are active and what events are they linked to?
- What did I commit to in the last committee meeting that's still open?
- When is our next External Affairs meeting and what should I prep?

## Marketing Lead — *The Hype Engine*

> Owns how DSEC shows up to campus — event promo, social content, and the club's
> voice through a small crew.

A committee-level lead accountable for turnout and the club's public presence,
directing a marketing/design crew and reporting up to Exec. Each week they
reverse-engineer a promo plan from the event calendar, assigning captions,
graphics, and reels and chasing the assets that must ship before each event date.
They run a short standup, capture who-owns-what, and personally write the
highest-stakes posts.

**Opens the dashboard to ask:**
- What events are coming up, and is our promo plan far enough ahead of each date?
- Is my marketing team behind on anything — what's overdue right now?
- What promo assets are on MY plate to ship this week?
- What did we commit to in the last committee meeting, and is it moving?
- What's landing across the club in the next two weeks that we need to promote?

## Marketing Member — *The Hype Builder*

> Turns the club's upcoming events into posters, captions, and social posts — one
> assigned task at a time.

A rank-and-file marketing member, usually a first- or second-year, who executes
promo work rather than running the committee. In a typical week they pull their
assigned design/copy tasks, scan the event calendar to see what needs promoting
next, and build the graphics with enough lead time. They attend the weekly
standup and ship content against deadlines.

**Opens the dashboard to ask:**
- What marketing tasks are assigned to me, and which is due first?
- Which events are coming up that I need promo for, and how much lead time?
- What follow-ups did I pick up from the last marketing meeting?
- When is our next committee meeting?

## Design Lead — *The Asset Marshal*

> Runs the design team and owns every visual the club ships — posters, banners,
> and brand consistency, on time.

A senior student creative who heads Design, splitting time between hands-on
production and delegating to junior designers, accountable for every visual the
club ships. They triage incoming requests against the event calendar, break them
into tasks, and produce the hero art themselves. They review drafts, keep briefs
and brand assets organized in shared docs, and chase the tightest-lead-time
deliverables.

**Opens the dashboard to ask:**
- What design deliverables do I personally owe right now, and what's due next?
- Which upcoming events still need assets — and do we have lead time to make them?
- Is my design team on track, or is anything overdue or stuck?
- What design follow-ups came out of our last meeting?
- Where's the latest brief, brand guide, or set of meeting notes I need?

## Design Member — *The Asset Crafter*

> Turns event briefs into posters, social assets, and branding on deadline.

A hands-on creative who executes rather than oversees — taking a brief and
shipping the artwork by the date it's needed. Most of their week is heads-down
production against a short list of assigned tasks, each tied to a real event date.
They check the calendar to confirm deadlines and pick up revision notes from the
last crit.

**Opens the dashboard to ask:**
- What design tasks are assigned to me and which are due first?
- Which events are coming up, so I know the real deadline behind each asset?
- Did any revisions or follow-ups land on me from the last design crit?
- When is the next Design meeting or review I need to show up to?

## Development Lead — *The Build Captain*

> Steers DSEC's in-flight build projects from idea to demo, keeping the dev team
> unblocked and shipping.

A senior student who heads Development — the team that builds DSEC's community and
technical projects — owning the roadmap and answering to Exec for on-time
delivery. Their week is triaging project boards, breaking work into tasks and
assigning them, and running a weekly build sync. They update project status,
capture action items, and watch for anything drifting overdue while staying
hands-on.

**Opens the dashboard to ask:**
- Which of my projects are on track, and which are stalled or blocked?
- Does anyone on my dev team have overdue tasks I need to rebalance?
- What do I personally owe this week?
- What's our next build sync, and who's expected?
- What follow-ups from the last meeting still aren't done?

## Development Member — *The Hands-On Builder*

> Builds and ships the club's community/engineering projects and owns their slice
> of the backlog.

An individual contributor on Development — typically a student engineer assigned
to one or two in-flight projects — whose mandate is execution: take a project task
and ship it. Their week is in /projects updating the status of a project they own,
ticking off assigned tasks, and prepping a build for an upcoming demo. They show
up to the dev sync to unblock.

**Opens the dashboard to ask:**
- Which of my projects are in flight right now and what status is each in?
- What tasks are assigned to me, and what's due next?
- Which event or demo am I building toward, and when does it land?
- When is the next Development sync I need to show up for?

## General Member — *The Reliable Doer*

> Shows up, takes the tasks handed to them, and helps run events — owns their own
> to-do list and nothing more.

A student volunteer on a committee (or club-wide) with no management remit — the
broad base that executes the work leads delegate, with authority stopping at their
own assigned tasks. They log in to see what's been assigned, tick tasks off, and
confirm the time and place of their next meeting. Around events they're hands-on:
setup, registration desk, running a station.

**Opens the dashboard to ask:**
- What's on my plate right now, and what's due first?
- When and where is my next committee meeting so I don't miss it?
- What events are coming up that I'm expected to help run or attend?
- Of my tasks, is anything overdue or due this week?

## Treasurer — *The Ledger-Keeper*

> The single owner of the club's money — tracks the balance, records spending, and
> keeps every event on budget.

An elected officer personally accountable for DSEC's finances to the exec and to
DUSA, with a narrow but deep mandate: one module, finance, with full read and
write. They reconcile new transactions, log reimbursements tied to recent events,
and answer spend questions from leads. Around events they set and watch budgets;
at exec meetings they report the running balance and flag overspend.

**Opens the dashboard to ask:**
- What's our current balance, and how do income and expenses sit this period?
- Is any event over (or close to) its allocated budget right now?
- Where is the money actually going — which categories are growing?
- Are there recent expenses I still need to record or reconcile?
- Can I give the exec an accurate financial snapshot for the next meeting?

## Auditor — *The Books-Balancer*

> The independent financial watchdog — verifies every dollar in and out and checks
> spend against the approved budget.

A senior, trusted student elected to keep the committee financially honest,
sitting outside the day-to-day operating roles to provide independent oversight
before anything reaches the AGM or DUSA. They reconcile transactions, compare each
event's spend against budget, and check that booked sponsor income has landed.
They rarely change anything — they read across every committee and write up
findings as their own audit tasks.

**Opens the dashboard to ask:**
- What's our current balance, and is income keeping pace with expenses?
- Is any event over its allocated budget right now?
- Where is the money actually going — which categories dominate?
- Has the sponsor income we booked actually come through?
- What audit reviews or sign-offs do I owe before the next meeting?

## Viewer — *The Newcomer*

> A freshly-onboarded, not-yet-placed member — owns nothing yet and is waiting to
> be slotted into a committee.

The lowest-privilege seat: a brand-new or unassigned member who has finished
onboarding but hasn't been given a committee or any module access. They log in
once or twice to check whether anyone has assigned them a starter task and to look
for a signal about which committee they'll join. Their time in the workspace is a
holding pattern until an admin grants access — the dashboard shows a welcome /
placement shell rather than data tiles.

---

## Viewing another role's dashboard

Admins can see the workspace (including the dashboard) the way a different role
sees it via **Admin → Roles → Preview as this role** — a full, narrow-only role
preview that swaps in that role's nav, dashboard, and landing page and disables
writes while active. (There is no dashboard-header switcher.)

## How it's wired

| Concern | Lives in |
|---|---|
| Section catalogue + per-role defaults + personas | `src/lib/dashboard-config.ts` |
| Dashboard composition | `src/app/(app)/dashboard/page.tsx` + `sections.tsx` |
| Admin role editor (toggles + persona blurb) | `src/app/(app)/admin/roles/role-form.tsx` |
| Seed for new installs | `scripts/setup-roles-v2.ts` |
| Force-apply / restore to live roles | `scripts/apply-role-dashboards.ts` |
