/**
 * One-time (idempotent) migration: create the per-user `event_view` table that
 * backs the Events Views engine's custom SAVED views.
 *
 *   npx tsx scripts/add-event-view-table.ts
 *
 * Each row is one user's saved lens (filter/group/sort/mode) over the events
 * pool, stored in `config` JSONB (shape = ViewConfigEV, lib/event-view-types).
 * Hub-owned — dsec-api never reads this. FK to app_user with ON DELETE CASCADE
 * so a deleted user's saved views are cleaned up automatically. Mirrors
 * scripts/add-task-view-table.ts.
 *
 * Additive + idempotent (CREATE TABLE / INDEX IF NOT EXISTS) — safe to re-run.
 *
 * NOTE: app-owned table, added here by hand — never via `alembic --autogenerate`
 * (which can emit destructive DROPs against the live Neon database).
 */
import { config } from "dotenv";

config({ path: ".env.local" });

const DDL = `
CREATE TABLE IF NOT EXISTS event_view (
  id          serial PRIMARY KEY,
  user_id     integer NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  name        varchar(128) NOT NULL,
  description text,
  config      jsonb NOT NULL DEFAULT '{}',
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  archived    boolean NOT NULL DEFAULT false
);
CREATE INDEX        IF NOT EXISTS ix_event_view_user_id   ON event_view (user_id)               WHERE archived = false;
CREATE UNIQUE INDEX IF NOT EXISTS ix_event_view_user_name ON event_view (user_id, lower(name))  WHERE archived = false;
`;

async function main() {
  const { Pool } = await import("pg");

  const url = new URL(process.env.DATABASE_URL ?? "");
  const needsSsl = url.searchParams.get("sslmode") === "require";
  url.searchParams.delete("sslmode");
  const pool = new Pool({
    connectionString: url.toString(),
    ssl: needsSsl ? { rejectUnauthorized: true } : undefined,
  });

  try {
    console.log("Creating event_view table + indexes (idempotent)…");
    await pool.query(DDL);

    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM event_view`);
    console.log(`Done. event_view exists with ${rows[0].n} saved view(s).`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
