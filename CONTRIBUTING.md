# Contributing to dsec-hub

The committee dashboard behind **hub.dsec.club**. Next.js 16 + Drizzle. It reads
and writes the **shared production database** directly, so treat every write path
as touching real member data.

## Ground rules

1. **No secrets in the repo.** No `.env`, connection strings, or tokens in a
   commit — ever.
2. **dsec-hub does NOT own the schema — `dsec-api` does.** Drizzle is used in
   **introspect-only** mode: `src/db/schema.ts` mirrors the real schema, it does
   not define it. **Never run `drizzle-kit push`** — it would rewrite the shared
   database out from under the API.
3. **App-owned tables go through idempotent scripts.** Tables that only the hub
   uses are added via `scripts/*.ts` that are safe to re-run. Keep them idempotent.
4. **No member PII in logs.** Never log submitted names, student IDs, or emails.

## How to contribute

1. Branch from `main`: `git checkout -b feat/<short-name>`.
2. Make the change and run the local gate:
   ```bash
   npm run typecheck && npm run lint && npm run build
   ```
3. Open a PR against `main` and fill in the template.
4. A code owner reviews. `src/db/*schema.ts`, `drizzle.config.ts`, and `scripts/`
   are **maintainer-only** — see [CODEOWNERS](.github/CODEOWNERS).

## Publishing student projects

The hub is where a committee member publishes a project to the public showcase on
dsec.club. Two policies apply:

- **Publishing is coupled to review state.** When the schema gains a review gate,
  the publish action must set the project's review fields (approved, reviewer,
  timestamp) in the **same** write that flips it public — otherwise the database
  constraint rejects the write and the publish button 500s. If you touch the
  publish path, keep it in step with the API schema.
- **No binary hosting.** The showcase may *link* to a student's build (GitHub
  Releases, itch.io) but the club never hosts or serves that executable,
  installer, APK, or firmware from any `*.dsec.club` origin — link out, don't
  upload. A browser-sandboxed web build is the only kind safe to embed.
- **Takedown is asymmetric — unpublish alone, republish with two.** This is a
  **governance rule the committee follows by hand** (the code today lets any
  authorised writer toggle publish either way — it does not yet enforce the
  two-person republish). Any single committee member may unpublish immediately;
  putting it back should wait on a second committee member. When in doubt,
  unpublish first.

If a change touches the schema mirror or the publish path, open an issue and flag
it — the maintainer coordinates those with the API.
