# Security policy — dsec-hub

## Reporting a vulnerability

Email **admin@dsec.club** with "SECURITY" in the subject. Please do not open a
public issue for anything exploitable.

Useful things to include: the URL or endpoint, what you did, what happened, and
whether you needed an account. We will acknowledge and keep you posted on a fix.
This is a student club, not a company with an on-call rota, so treat response
times as best-effort.

## Scope of this document

This file covers **dsec-hub only** — the committee dashboard at `hub.dsec.club`.
The public site (`dsec-website`), the member portal (`dsec-app`), the games
surface (`dsec-games`) and the API (`dsec-api`) each have their own repository
and their own security notes.

This is the highest-privilege surface of the four: it holds full CRUD over
events, people, projects, sponsors, finance, members, tasks, meetings and media.

## Application-layer rate limiting

This is the **only one of the four front-ends that implements rate limiting**.
It uses Upstash Redis, because that is the only store that counts accurately
across Vercel's short-lived function instances.

| Limiter | Key | Limit | Where |
|---|---|---|---|
| Anonymous per-IP | `rl:app:ip` | 120 req / 60 s | `src/lib/rate-limit.ts` via `src/proxy.ts` |
| Authenticated per-user | `rl:app:user` | 1000 req / 60 s | same |
| Login attempts | `rl:app:login` | 8 / 60 s per (IP + email) | `src/auth.ts` `authorize()` |

Two things to be aware of:

- **It fails open.** If `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`
  are unset, nothing is throttled and the app logs a warning at startup. Set both
  in production.
- **The proxy matcher excludes `/api`**, so route handlers are not covered by the
  per-IP limiter. The login throttle lives inside `authorize()` for exactly this
  reason.

Tune the limits by editing the `Ratelimit.slidingWindow(...)` calls in
`src/lib/rate-limit.ts`.

## Other controls

| Control | Where | Notes |
|---|---|---|
| Role-based access control | `src/lib/rbac.ts`, `src/lib/dal.ts` | Per-module gating. See [`ROLES.md`](./ROLES.md). |
| Password hashing | bcryptjs | Exec logins are created with `scripts/create-user.ts`. |
| Cron authentication | `src/app/api/cron/notifications` | `Authorization: Bearer ${CRON_SECRET}`. |
| API→hub assignment hand-off | `/api/internal/notify-assignment` | `HUB_NOTIFY_SECRET`, must match `dsec-api`. Returns 500 when unset, i.e. fails closed. |

### Known gaps in this repo

- **The Telegram webhook fails open.** `src/app/api/telegram/webhook/route.ts`
  only verifies the shared secret when `TELEGRAM_WEBHOOK_SECRET` is set. With it
  blank — the shipped `.env.example` default — the endpoint accepts
  unauthenticated POSTs that write to the database. Set the secret, or treat the
  endpoint as untrusted input.
- **Two signing keys fall back to committed literals.**
  `src/lib/role-preview.ts` and `src/lib/undo-sign.ts` fall back to
  `"dev-insecure-preview-secret"` and `"dsec-dev-undo-signing-key"` when neither
  `AUTH_SECRET` nor `NEXTAUTH_SECRET` is set. Those strings are in this public
  repository. `AUTH_SECRET` must be set in production.
- **`NEXTAUTH_SECRET` is only partially honoured.** It is accepted by those two
  modules but not by Auth.js itself, so a deploy that sets only `NEXTAUTH_SECRET`
  and not `AUTH_SECRET` will fail on signed-in requests. Use `AUTH_SECRET`.
- `next-auth` is pinned to a pre-release (`5.0.0-beta.31`) with a caret range.

## Edge protection

The `hub.dsec.club` DNS record is grey-cloud (DNS-only) in Cloudflare, so
Cloudflare's proxied protections — WAF rules, rate-limiting rules, Bot Fight
Mode — are **not** in the request path. Edge mitigation is whatever the Vercel
project's Firewall settings provide, on top of the in-app limiters above.

> **Migration note.** `api.dsec.club` is moving off Vercel to an OVH VPS, so edge
> protection for the API becomes a VPS concern (reverse-proxy rate limiting, or
> orange-clouding the `api` record) rather than a Vercel Firewall rule. Nothing
> in this repo changes, but the API is no longer behind the same layer.
