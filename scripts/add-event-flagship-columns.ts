/**
 * One-time (idempotent) migration: add the flagship-event marketing columns to
 * `events`.
 *
 *   npx tsx scripts/add-event-flagship-columns.ts
 *
 * A flagship is a marquee event (hackathon / big collab) with a bespoke website
 * template and a teaser→revealed lifecycle. These app-owned columns mirror the
 * is_public publish pattern. Additive, `IF NOT EXISTS` — safe to re-run.
 * `is_flagship`/`flagship_theme`/`flagship_state` are NOT NULL with defaults
 * (false/'arena'/'teaser') so the website always has a flag + template + lifecycle
 * to render; the teaser copy is nullable. See FLAGSHIP_CONTRACT.md.
 *
 * NOTE: the `flagship_signup` TABLE is created by the dsec-api migration (the hub
 * only reads it) and is intentionally NOT created here.
 *
 * NOTE: dsec-api owns the core schema via Alembic; these app-owned columns are
 * added here by hand (never via `alembic --autogenerate`, which can emit
 * destructive DROPs against the live Neon database).
 */
import { config } from "dotenv";

config({ path: ".env.local" });

const DDL = `
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_flagship boolean NOT NULL DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS flagship_theme varchar(16) NOT NULL DEFAULT 'arena';
ALTER TABLE events ADD COLUMN IF NOT EXISTS flagship_state varchar(16) NOT NULL DEFAULT 'teaser';
ALTER TABLE events ADD COLUMN IF NOT EXISTS flagship_teaser_title varchar(256);
ALTER TABLE events ADD COLUMN IF NOT EXISTS flagship_teaser_body text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS flagship_reveal_at timestamptz;
CREATE INDEX IF NOT EXISTS ix_events_is_flagship ON events (is_flagship);
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
    console.log("Adding events flagship columns (idempotent)…");
    await pool.query(DDL);

    const { rows } = await pool.query(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_name = 'events' AND column_name IN (
         'is_flagship', 'flagship_theme', 'flagship_state',
         'flagship_teaser_title', 'flagship_teaser_body', 'flagship_reveal_at'
       )
       ORDER BY column_name`,
    );
    console.log("Done. events flagship columns:");
    for (const r of rows) {
      console.log(`  • ${r.column_name} (${r.data_type})`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
