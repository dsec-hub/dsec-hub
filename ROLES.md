# Roles, Admin & Invites

Role-based access control for the dsec-app dashboard. Admins manage users, roles,
and invites from **/admin**; everyone else sees only the modules their role grants.

## Concepts

- **Modules** — gateable areas: `events`, `people`, `sponsors`, `finance`, `tasks`,
  `projects`, `members`, `meetings`, `documents`, `admin`. The **Dashboard** (`/`,
  which redirects to `/dashboard`) is always available to any active user.
- **Read vs write** — each module is granted as **View** (`modules`) or **Edit**
  (`writeModules` ⊆ `modules`); write always implies read.
- **Role** — a named set of modules (stored in `app_role`). A role that includes
  the `admin` module is a **superuser**: full access to every module plus the
  admin panel.
- **User** (`app_user`) — has one role (`app_user.role_id`) and an optional linked
  roster record (`app_user.person_id`) used for object-level access (below).
- **Invite** (`app_invite`) — an emailed, single-use, 7-day link that lets someone
  set a password and join with a pre-assigned role.

Built-in roles seeded by setup: **Admin** (system, full access), **Exec** (all
operational modules), **Events Lead**, **Sponsorship**, **Treasurer**, **Viewer**
(dashboard only). Admins can create/edit/delete custom roles in **/admin/roles**.

## Object-level access (ownership)

Layered **on top of** the module RBAC and **purely additive** — it only ever
*grants* extra scoped access, never restricts a role grant:

- A user who **leads a project** (`projects.lead_id` = their `person_id`) but is
  **not** granted the whole Projects module still sees **that project and its
  tasks — read only** — in the nav, the projects list (only theirs; no
  cross-project stats), and the detail page. Editing stays module-gated, so a
  scoped owner can never be escalated to a writer.
- A member who should only touch tasks gets exactly the **Tasks** module and
  nothing else.

The pure decisions live in `lib/rbac.ts` (`isOwner`, `scopeFor`, unit-tested in
`lib/rbac.test.ts` — `npx tsx src/lib/rbac.test.ts`); the DB lookups in
`lib/scope.ts`. The shape generalises to `events.event_lead_id` /
`tasks.assignee_id` — add a `<module>Scope` + `requireXView` pair per module.

## Self-service API / MCP tokens

Any user whose role permits it can mint their own `dsec_live_…` API key from
**Settings → API & MCP** (`lib/api-tokens.ts`) to connect the workspace to an MCP
client (Claude/ChatGPT). API-key scopes are **coarse and global** (`read` /
`write` / `trigger` / `ingest`) — they are *not* per-module, so a `write` token
can write every module via MCP. The UI states this; what a user may mint is
bounded by their role:

| scope     | a user may mint it when…                    |
| --------- | ------------------------------------------- |
| `read`    | they can **view** any module                |
| `write`   | they can **edit** any module                |
| `trigger` | they can **edit Meetings** (AI notes)       |
| `ingest`  | they are an **admin**                       |

Minting is proxied to dsec-api (`POST /admin/keys/self`), which owns key
generation + argon2 hashing and re-checks `requested ⊆ the service key's scopes`
(so even a leaked service key can't mint something more powerful than itself).
Tokens are owned via `api_key.created_by = "appuser:<id>"`; listing/revoking
read/write that table directly (ownership-checked). Note: `trigger`/`ingest`
tokens require the production `DSEC_API_KEY` service key to itself hold those
scopes.

### The `llm.md` guide (auto-generated)

Whenever a token is minted — and per-token, and for the whole role — the UI
offers a downloadable **`llm.md`**: an instruction sheet you hand to an AI
assistant (Claude Code, Codex, ChatGPT, a Claude chat) so it knows how to drive
the MCP with exactly the tools that token's scopes allow. It's rendered
server-side by dsec-api from a single tool catalogue
(`app/features/mcp/catalog.py`), so it can never drift from the real tools — a
test asserts the catalogue matches the registered FastMCP tools. The guide
carries **no secret** (the key is a `dsec_live_YOUR_KEY` placeholder). Endpoint:
`GET /mcp-setup/llm?scopes=read,write`; the dashboard proxies it through
`/settings/api/llm-guide` for download. Regenerate the committed full-scope copy
(repo-root `llm.md`) with `dsec-api/scripts/gen_llm_guide.py`.

## Enforcement (defense in depth)

1. **Proxy** (`proxy.ts` → `auth.config.ts`) — coarse route gate from the JWT
   module snapshot.
2. **DAL** (`lib/dal.ts`) — `requireModule(key)` / `requireWrite(key)` /
   `requireAdmin()` re-read the DB on every page and Server Action, so role
   changes take effect immediately. Object-level views use `lib/scope.ts`.
3. **Nav** — the sidebar only shows modules the user can access (module grant or
   scoped ownership).

## One-time setup

The RBAC tables are **app-owned** (created here, not by the dsec-api Alembic
migrations). Run the idempotent setup once against the database:

```bash
npx tsx scripts/setup-roles.ts
```

This creates `app_role` + `app_invite`, adds `app_user.role_id`, seeds the
built-in roles, and assigns every existing user the **Admin** role so current
execs keep full access. Safe to re-run.

Bootstrap or promote an admin login directly:

```bash
npx tsx scripts/create-user.ts you@example.com 'a-strong-password' 'Your Name'
# create-user assigns the Admin role automatically.
```

## Email (invites)

Invites send via the Resend HTTP API. Set in `.env.local`:

```
RESEND_API_KEY=re_...                       # optional
EMAIL_FROM=DSEC Dashboard <invites@your-domain>   # a Resend-verified sender
APP_URL=https://your-app.example.com        # used to build invite links
```

If `RESEND_API_KEY` is **not** set, invites still work: the admin UI shows a
**copyable invite link** to share manually (and the link is logged server-side).
`APP_URL` is **required in production** — invite links carry a single-use token,
so the origin is never derived from the (spoofable) `Host` header there; it only
falls back to the request host in local dev.
