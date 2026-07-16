# Cross-repository contract

`dsec-hub` is the committee dashboard at `hub.dsec.club`.

- `dsec-api` owns the shared Neon schema. Run its Alembic migrations before this
  app's idempotent scripts in `scripts/`; do not autogenerate Alembic migrations
  for hub-owned tables.
- This app accesses Neon directly with `DATABASE_URL`, and calls `dsec-api` for
  AI notes and media using `DSEC_API_URL` and `DSEC_API_KEY`.
- `REVALIDATE_SECRET` must equal the value in `dsec-website`; this app uses it
  with `DSEC_WEBSITE_URL` to refresh public-site content after edits.
- `HUB_NOTIFY_SECRET` must equal `dsec-api`'s configured value for assignment
  notifications.

Deploy after `dsec-api`. The paired production services are
`https://api.dsec.club` and `https://dsec.club`.
