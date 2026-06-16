# DSEC — exec dashboard (`dsec-app`)

The internal, login-gated dashboard the DSEC committee uses to run the club:
full CRUD over events, people, projects, sponsors, finance, members, tasks,
meetings, documents, and media. Built with **Next.js 16 (App Router) + React 19 +
TypeScript + Tailwind v4**, **Auth.js v5** for per-person login, and **Drizzle
ORM** talking to **Neon Postgres**.

Neon is the single source of truth: `dsec-api` **owns** the core schema (SQLAlchemy
+ Alembic), and this app reads/writes the tables directly via Drizzle. A handful of
**app-owned** tables (roles, invites, settings, committee) are created by the setup
scripts in `scripts/` rather than by Alembic.

It's deliberately **dependency-light** — no shadcn/Radix; the UI is built in-house
(custom selects, date controls, cropper, toasts) so it renders consistently across
browsers. Access is **role-based** (RBAC) per user — see [`ROLES.md`](./ROLES.md).
The visual system is **DSEC Action Pink (`#e91e63`)** on a near-black,
Resend-inspired canvas — see [`DESIGN.md`](./DESIGN.md).

## Run it

```bash
npm install
cp .env.example .env.local   # then fill DATABASE_URL + AUTH_SECRET (see below)
npm run dev                  # http://localhost:3000
npm run build                # production build
```

Sign in at `/signin` with an exec login you create with the scripts below.

## First-run setup (against your Neon DB)

`dsec-api`'s Alembic migrations create the core schema. These scripts add the
**app-owned** RBAC/settings tables and seed data on top. They're idempotent
(`IF NOT EXISTS`) and safe to re-run; run them once, in this order:

```bash
npx tsx scripts/setup-roles.ts             # app_role, app_invite, app_user.role_id; seeds built-in roles; backfills Admin
npx tsx scripts/setup-settings.ts          # app_setting (site settings)
npx tsx scripts/create-committee-table.ts  # committee table + seed
npx tsx scripts/add-role-write-modules.ts  # app_role.write_modules
npx tsx scripts/add-invite-committee-column.ts
npx tsx scripts/add-user-theme-columns.ts  # app_user theme cols (otherwise gated pages 500)
npx tsx scripts/add-event-time-columns.ts  # events.start_time / end_time

# Create (or reset) your first exec login:
npx tsx scripts/create-user.ts you@dsec.club 'a-strong-password' 'Your Name'
```

Re-running `create-user.ts` with a new password for an existing email **resets** it.
If a script errors that a base table is missing, the core Alembic migrations haven't
been applied yet — see `dsec-api`.

## Modules

The authenticated app lives under `src/app/(app)/`. The **Overview**
(`/dashboard`) is always available; every other module is gated by the user's role
(`events`, `people`, `projects`, `sponsors`, `finance`, `members`, `tasks`,
`meetings`, `documents`, `media`, `settings`, `admin`). Admins manage users, roles,
and invites from `/admin`. See [`ROLES.md`](./ROLES.md) for the full RBAC model.

## Environment

Copy `.env.example` → `.env.local`. Real secrets are never committed (`.env.local`
is gitignored).

| Var | Needed | Purpose |
|---|---|---|
| `DATABASE_URL` | ✅ | Neon Postgres — the **same** DB `dsec-api` owns; use the **pooled** (`-pooler`) string in prod. |
| `AUTH_SECRET` | ✅ | NextAuth session signing key (`openssl rand -base64 32`). |
| `APP_URL` | ✅ | Public base URL (used in invite links); `http://localhost:3000` locally. |
| `DSEC_API_URL` | ⚠️ AI/media | `dsec-api` base URL — enables AI meeting notes + image upload. |
| `DSEC_API_KEY` | ⚠️ AI/media | API key with **both** `trigger` (AI notes) and `write` (media) scopes. Blank disables those features. |
| `RESEND_API_KEY` / `EMAIL_FROM` | optional | Member-invite emails via Resend (logs the link if unset). |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | prod | Per-IP throttle + login brute-force guard. Blank → rate limiting fails open. See [`../SECURITY.md`](../SECURITY.md). |

## Project layout

```
src/
  app/
    (app)/        # authenticated dashboard (dashboard, events, people, projects,
                  # sponsors, finance, members, tasks, meetings, documents, media,
                  # settings, admin, docs, export)
    api/          # route handlers (incl. NextAuth)
    signin/  invite/   # public auth pages
    globals.css   # Tailwind v4 @theme — the Action Pink design system
  components/     # in-house UI (no shadcn/Radix): icons, markdown, media-manager, …
  db/             # Drizzle schema (schema.ts + workspace-schema.ts) + client
  lib/            # auth/dal, rate-limit, workspace-queries, helpers
scripts/          # idempotent DB setup + user/role seeding (run with tsx)
```

## Deployment

Deploys to **Vercel** as its own project (**Root Directory `dsec-app`**). Set
`DATABASE_URL` (pooled) + `AUTH_SECRET` + `AUTH_TRUST_HOST=true` at minimum. See
[`../DEPLOY.md`](../DEPLOY.md) (quick path) and [`../HOSTING.md`](../HOSTING.md)
(full runbook), and [`../SECURITY.md`](../SECURITY.md) for rate limiting.

## License

Copyright © 2026 DSEC. Licensed under **AGPL-3.0-only** — see the repo `LICENSE`.
