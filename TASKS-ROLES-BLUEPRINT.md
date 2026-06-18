# DSEC Workspace — Tasks-Views + Role-Focus + Hybrid-Scoping + Role-Preview: Implementation Blueprint

> Generated 2026-06-17 from a design/spec workflow (6 subsystem architects → 2 adversarial reviewers → synthesis). Authoritative execution reference. Companion: `tasks-views-roles-initiative` memory + this repo's `ROLES.md`.

All paths absolute under `/Users/clupa/Documents/projects/dsec/dsec-monorepo`. Two repos: `dsec-hub` (Next.js committee dashboard) and `dsec-api` (FastAPI + Alembic + MCP).

---

## 1. Architecture Overview

### 1.1 Two layers, never confused: ACCESS vs FOCUS

Invariant both reviewers demanded: **Focus may only narrow what Access already grants. It can never escalate.**

- **ACCESS (authoritative, enforced):** existing module RBAC — `rbac.ts` (`canAccess`, `canWrite`, `levelFor`) + DAL gates (`requireModule`→redirect `/dashboard` `dal.ts:108`, `requireWrite` `dal.ts:120`) + edge route gate (`auth.config.ts:30-33`) + object-level additive scope (`scope.ts` `projectScope`). Extended only to: (a) generalise object-scope to events/tasks, (b) object-level **task write for one's own assigned tasks** (Member rule), (c) **API/MCP parity** (module-scoped tokens).
- **FOCUS (presentation only):** new `app_role.viewConfig` JSON + per-user `task_view` table + Tasks views engine. Consulted only after Access resolves; filters the already-authorised set; cannot widen. Every Focus consumer still hard-gates with `requireModule`/`canAccess` first.

### 1.2 Views Engine (Tasks)

Single task pool, swappable lenses. State `ViewConfigTV = { filter, groupBy, sort, mode }`. Pure helpers (`applyFilters`/`groupTasks`/`sortTasks`/`builtInViews`) run server-side; URL carries only `?view=<key|saved:id>` + optional `?group=&sort=&dir=&mode=` overrides (ad-hoc filter blobs live in DB saved views, not URL). Built-ins: **My Work** (assignee=me), All Tasks, By Committee, By Event/Project, per-board kanban. Per-user **saved views** in `task_view`. Role default = built-in key string in `viewConfig.defaultTaskView` (string, not FK).

### 1.3 Hybrid committee scoping — what "enforced" actually adds

- **Tasks / Events / Projects = FOCUS-ONLY.** Module grant = full visibility; additive object-scope lets a non-module owner see records they lead/are-assigned (read-only today; **write-own-task** added). `committee` = presentation default filter, never a hard gate.
- **Sponsors / Finance = ENFORCED.** No scoped-owner fallback. UI enforcement already exists (`requireModule` on every page + `requireWrite` on actions). The gap being closed: **API/MCP parity** — MCP tools call only `require_scope('write')`, so any blanket-`write` key reaches `create_sponsor`/`set_event_budget`. Add module-scoped scopes (`read:sponsors`/`write:finance`) + derive OAuth token scopes from role modules.
- Sponsors need **no** per-committee subdivision (owned by External Affairs, shared club-wide).

### 1.4 Role Preview (admin impersonation)

HMAC-signed `preview_role` cookie (keyed on `AUTH_SECRET`, HttpOnly/Secure/SameSite=Strict, 1h TTL default). `getCurrentUser()` overlays previewed role by **intersecting** module sets (narrow-only; preview of an admin role rejected). Single mutation chokepoint — `requireWrite()` throws while previewing. Persistent banner. Edge route gate keeps using **real** JWT modules.

---

## 2. Data Model — DDL + safe migration path

> **Migration doctrine (CRITICAL):** backend-owned tables (`task`) → **hand-written** Alembic only, NEVER `alembic --autogenerate` against live Neon (emits DROPs for app-owned RBAC objects). App-owned objects (`app_role` columns, `task_view`) → idempotent `dsec-hub/scripts/*.ts` (`pg.Pool` + `IF NOT EXISTS`). All indexes `IF NOT EXISTS`. `DEPLOYMENT_ORDER.md` records canonical sequence.

### 2.1 `app_role.viewConfig` — APP-OWNED (dsec-hub script) — Phase 0

```ts
// defined ONCE in dsec-hub/src/db/schema.ts
export type ViewConfig = {
  version: 1;
  sections: Record<string, boolean>;   // CANONICAL_SECTIONS id -> visible
  landingPath?: string;                // validated against role modules
  defaultTaskView?: string;            // BUILT-IN key only
  navOrder?: string[];                 // nav GROUP labels, narrow + reorder
};
```
Script `scripts/add-app-role-view-config-column.ts`:
```sql
ALTER TABLE app_role ADD COLUMN IF NOT EXISTS view_config jsonb DEFAULT NULL;
UPDATE app_role SET view_config = '{"version":1,"sections":{}}'::jsonb WHERE view_config IS NULL;
```
Drizzle (`schema.ts`, after `writeModules` ~232): `viewConfig: json("view_config").$type<ViewConfig>(),` (nullable; normalised in DAL via `getDefaultViewConfig`).

### 2.2 `task_view` — APP-OWNED (dsec-hub script) — Phase 0

Single owner = data-layer. No `role_id`. Lives in `schema.ts` (FKs `app_user`).
```sql
CREATE TABLE IF NOT EXISTS task_view (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  name varchar(128) NOT NULL,
  description text,
  config jsonb NOT NULL DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived boolean NOT NULL DEFAULT false
);
CREATE INDEX        IF NOT EXISTS ix_task_view_user_id   ON task_view (user_id) WHERE archived = false;
CREATE UNIQUE INDEX IF NOT EXISTS ix_task_view_user_name ON task_view (user_id, lower(name)) WHERE archived = false;
```
Drizzle `appTaskView` in `schema.ts`; `config` typed `ViewConfigTV` from `task-view-types.ts`.

### 2.3 `task.parent_task_id` — BACKEND-OWNED (Alembic) — Phase 6 ONLY

All parent_task_id work (Alembic + SQLAlchemy + Pydantic + MCP + Drizzle + UI) in ONE Phase-6 commit. `down_revision` = real current head (run `alembic heads`). FK `ON DELETE CASCADE` + app-level cascade-archive of children in `archiveTask`.
- `models.py` Task (after board_id ~574): `parent_task_id ... ForeignKey("task.id", ondelete="CASCADE")`
- `tasks/schemas.py`: add to `TaskBase` + `TaskOut`
- `mcp/server.py` create_task(636)/update_task(652): add `parent_task_id`
- `workspace-schema.ts` tasks (after boardId ~144): `parentTaskId: integer("parent_task_id"),`

### 2.4 No schema change for committee scope
`people.committee`, `events.committee`, `task.committee`, `task_board.committee` already exist. Hybrid scoping = pure application code.

---

## 3. Role + Committee Seed

### 3.1 Committee migration — `scripts/update-committees-v2.ts` (Phase 1)
Idempotent, single transaction, pre/post count assertions. Today: Executive, Events, Marketing, Sponsorship, Technical, Operations.
```sql
BEGIN;
UPDATE committee  SET name='External Affairs', updated_at=now() WHERE lower(name)='sponsorship';
UPDATE people     SET committee='External Affairs' WHERE lower(committee)='sponsorship';
UPDATE events     SET committee='External Affairs' WHERE lower(committee)='sponsorship';
UPDATE task       SET committee='External Affairs' WHERE lower(committee)='sponsorship';
UPDATE task_board SET committee='External Affairs' WHERE lower(committee)='sponsorship';
INSERT INTO committee (name, color, is_active, sort_order)
SELECT 'Design', '#ec4899', <ACTIVE?>, 6
WHERE NOT EXISTS (SELECT 1 FROM committee WHERE lower(name)='design');
COMMIT;
```
Assert post-`External Affairs` count == pre-`Sponsorship` count per table. Marketing untouched.

### 3.2 Role seed — `scripts/setup-roles-v2.ts` (Phase 1)
New file (never edits legacy `setup-roles.ts`). Idempotent `INSERT … WHERE NOT EXISTS`; backfill viewConfig; never clobber custom roles/assignments. **BUG FIX:** `setup-roles.ts:19-29` `APP_MODULES` omits `"partners"` — v2 list = events, people, sponsors, partners, finance, tasks, projects, members, meetings, documents.

**Lead vs Member:** Lead = write on committee domain + assign tasks (`tasks` in writeModules). Member = read + write only OWN assigned tasks (`tasks` in modules, NOT writeModules; `canWriteTask` grants self-task writes).

| Role | isSystem | modules (read) | writeModules | landingPath | sections (visible) | defaultTaskView |
|---|---|---|---|---|---|---|
| Admin (President) | true | ALL incl admin | ALL incl admin | /dashboard | all | all-tasks |
| Exec (VP) | false | all 10 operational | all 10 operational | /dashboard | my_work, upcoming_events, tasks_due_soon, action_items, committee_health, membership, finance_summary, sponsor_pipeline | my-work |
| Secretary | false | meetings, documents, people, tasks | meetings, documents | /meetings | my_work, upcoming_events, action_items | my-work |
| External Affairs Lead | false | sponsors, partners, people, tasks, events | sponsors, partners, tasks | /sponsors | my_work, sponsor_pipeline, upcoming_events, action_items | by-committee |
| External Affairs Member | false | sponsors, partners, people, tasks | sponsors, partners | /sponsors | my_work, sponsor_pipeline | my-work |
| Marketing Lead | false | events, tasks, people, documents | tasks | /tasks | my_work, upcoming_events, tasks_due_soon, action_items | by-committee |
| Marketing Member | false | events, tasks, people | — (own-task) | /tasks | my_work, upcoming_events | my-work |
| Design Lead (empty) | false | projects, tasks, people, documents | projects, tasks | /tasks | my_work, upcoming_events, action_items | by-committee |
| Design Member (empty) | false | projects, tasks, people | projects | /tasks | my_work | my-work |
| Development Lead | false | projects, events, tasks, people, documents | projects, events, tasks | /projects | my_work, upcoming_events, action_items | by-committee |
| Development Member | false | projects, events, tasks, people | projects | /projects | my_work | my-work |
| General Member | false | tasks, people, events | — (own-task) | /tasks | my_work | my-work |
| Treasurer (keep) | false | finance | finance | /finance | finance_summary, expense_breakdown, event_budgets | my-work |
| Auditor (keep) | false | all 10 operational | — | /dashboard | upcoming_events, membership, finance_summary, sponsor_pipeline, committee_health | all-tasks |
| Viewer (keep) | false | — | — | /dashboard | (none) | my-work |

---

## 4. Phased Build Plan

```
Phase 0 (data foundation) ──┬──> Track A: Phase 2A (dsec-api security)  ── parallel, independent repo ──┐
                            └──> Track B: Phase 1 ──> Phase 2B ──┬──> Phase 3 (preview) ─┐             │
                                                                 └──> Phase 4 (views)   ─┴──> Phase 5 ─┴──> Phase 6 (subtasks)
```

### Shared-file ownership & merge order
| File | Phases | Owner / merge order |
|---|---|---|
| `src/db/schema.ts` | 0 | P0 sole editor (viewConfig col + ViewConfig type + appTaskView) |
| `src/db/workspace-schema.ts` | 6 | P6 sole editor (parentTaskId) |
| `src/lib/dal.ts` | 1,3 | P1 first (viewConfig+userCommittee+join+normalise), then P3 (preview overlay, requireWrite guard) |
| `src/lib/rbac.ts` | 1 | P1 sole editor (`isValidLandingPath`; keep edge-safe) |
| `src/lib/scope.ts` | 2B | P2B sole editor (event/task scope + `canWriteTask`) |
| `src/lib/workspace-queries.ts` | 2B,5 | P2B scope filters; P5 `getTasksByAssignee`/`getCommitteeHealth` (distinct names) |
| `src/lib/admin-queries.ts` | 1 | P1 sole editor (`RoleRow.viewConfig`) |
| `admin/roles/role-form.tsx`+`actions.ts` | 1 | P1 sole editor — ONE merged "Focus & Dashboard" section |
| `tasks/page.tsx`,`tasks/actions.ts` | 4 | P4 sole editor |
| `components/related-tasks.tsx` | 4 | P4 sole editor (hidden committee input) |
| `auth.config.ts` | 5 | P5 sole editor (redirect → access-denied) |
| `components/app-shell.tsx` | 3 | P3 sole editor (PreviewBanner) |
| `(app)/layout.tsx` | 5 | P5 sole editor (navOrder) |
| `dsec-api .../mcp/server.py` | 2A,6 | P2A sponsor/finance require_scope; P6 task parent_task_id |
| `dsec-api .../mcp/auth.py` | 2A | P2A sole editor (`has_scope`) |

### PHASE 0 — Data foundation (sequential, blocks all) — data-layer
CREATE: `scripts/add-app-role-view-config-column.ts`, `scripts/add-task-view-table.ts`, repo `DEPLOYMENT_ORDER.md`.
EDIT: `src/db/schema.ts` (ViewConfig type; appRole.viewConfig; appTaskView).

### PHASE 1 — Roles, committees, viewConfig plumbing (after P0) — role-focus
CREATE: `scripts/update-committees-v2.ts`, `scripts/setup-roles-v2.ts`, `src/app/(app)/dashboard/dashboard-config.ts` (pure: CANONICAL_SECTIONS, roleDefaultSections, getDefaultViewConfig).
EDIT: `rbac.ts` (`isValidLandingPath`), `dal.ts` (CurrentUser+viewConfig+userCommittee+people join+normalise), `admin-queries.ts`, `admin/roles/role-form.tsx` (Focus & Dashboard fieldset), `admin/roles/actions.ts` (parseViewConfig+validate), `(app)/page.tsx` (landingPath redirect).

### PHASE 2A — API/MCP security (parallel; after P0) — dsec-api
EDIT: `mcp/auth.py` (`has_scope`, rewrite `require_scope`), `mcp/server.py` (sponsor→`*:sponsors`, finance→`*:finance`), `oauth/service.py` (derive token scope from role modules; enforced modules get module scopes only), self-service key minting + `catalog.py` llm.md, `ROLES.md`.

### PHASE 2B — Hub scoping helpers (after P1) — hybrid-scoping (hub)
EDIT: `scope.ts` (`eventScope`/`requireEventView`/`canSeeEvents`, `taskScope`, `canWriteTask`), `workspace-queries.ts` (`getTasksByCommittee`/`getEventsByLead`/`getEventsByCommittee`), confirm `requireModule` on sponsors/finance **detail** routes.

### PHASE 3 — Role preview (after P1; ∥ P4) — preview
CREATE: `src/lib/role-preview.ts`, `settings/preview/page.tsx`, `settings/preview/actions.ts`, `components/preview-banner.tsx`.
EDIT: `dal.ts` (preview overlay in getCurrentUser; requireWrite throws while previewing), `app-shell.tsx` (banner), `settings/layout.tsx` (admin-gated tab + clear on signout).

### PHASE 4 — Views engine (after P2B; ∥ P3) — views-engine
CREATE: `task-view-types.ts`, `task-view-helpers.ts`, `task-view-queries.ts`, `tasks/view-actions.ts`, components `filter-bar.tsx`/`group-sort-controls.tsx`/`view-switcher.tsx`/`grouped-list-view.tsx`/`grouped-board-view.tsx`.
EDIT: `tasks/page.tsx`, `tasks-view.tsx`, `dnd-board.tsx` (groupBy prop), `tasks/actions.ts` (view-actions + `canWriteTask` auth), `related-tasks.tsx` (hidden committee input), entity detail pages pass `parentCommittee`.

### PHASE 5 — Dashboard + dead-ends (after P1,P2B,P3,P4) — dashboard
CREATE: `dashboard/sections.tsx`, `lib/dead-ends.ts`, `dashboard/(access-denied)/page.tsx`.
EDIT: `workspace-queries.ts` (`getTasksByAssignee`, `getCommitteeHealth` gated by `tasks` access), `dashboard/page.tsx` (render viewConfig.sections via Promise.allSettled), `auth.config.ts` (→ access-denied), `(app)/layout.tsx` (navOrder).

### PHASE 6 — Subtasks (optional; after P0) — data-layer + views-engine
All of §2.3 in one commit, then checklist UI in `tasks/[id]/edit`, "2/5" chip on cards, cascade-archive.

---

## 5. Security Checklist (attack → closure)
1. MCP blanket-write reaches sponsor/finance → P2A module scopes + role-derived OAuth scopes. **CRITICAL**
2. Preview cookie forgery → HMAC sign/verify on AUTH_SECRET, 1h TTL. **HIGH**
3. Preview escalation → intersect sets, reject admin-role preview, requireWrite throws. **HIGH**
4. Direct-URL sponsors/finance detail → confirm requireModule on detail routes. **HIGH**
5. getCommitteeHealth leak → gate caller by `tasks` access + section seeding. **HIGH**
6. landingPath → unauthorised module → `isValidLandingPath` validation. **MED**
7. defaultTaskView dangling → built-in string keys only. **MED**
8. `assignee:'me'` null personId → drop 'me' + warn. **MED**
9. Member object over-reach → `canWriteTask` ownership check. **MED**
10. Preview cookie survives logout → clear in signout, HttpOnly. **MED**
11. Committee rename non-atomic → single transaction + count assertions. **MED**
12. viewConfig NULL/old shape → version field + normalisation + backfill. **MED**
13. alembic autogenerate drops app objects → DEPLOYMENT_ORDER ban + hand-written only. **CRITICAL (ops)**
14. parent_task_id orphaning → FK CASCADE + app cascade-archive. **HIGH**
15. Silent module-denial dead-end → access-denied page. **LOW**

## 6. Verification
- **dsec-hub:** `npm run lint`, `npx tsc --noEmit`, `npm run build`; re-run P0/P1 scripts twice to prove idempotence.
- **dsec-api:** dev branch `alembic upgrade head`→`downgrade -1`→`upgrade head`; `ruff`, `mypy`, `pytest`; MCP scope tests (read:events key 403s on list_sponsors; legacy read passes).
- **Manual persona flows:** My Work default; role-distinct dashboard; task filter/group/save; access-denied page; quick-add committee; member own-task write; committee health; preview banner+write-block+tamper-ignored; API isolation.

## 7. Open Questions (resolved 2026-06-17)
1. Member task-create breadth — **<pending answer>**
2. Committee-health visibility — **<pending answer>**
3. Design committee activation — **<pending answer>**
4. Preview TTL — default 1h.
5. landingPath semantics — default bounce target, NOT a jail.
6. OAuth token migration — grandfather until expiry (dsec-api not yet deployed to prod).
7. task_view placement — hub-owned in schema.ts; no dsec-api reads.
