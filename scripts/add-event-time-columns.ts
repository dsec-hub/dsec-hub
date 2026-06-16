/**
 * One-time (idempotent) migration: add `start_time` and `end_time` to `events`.
 *
 *   npx tsx scripts/add-event-time-columns.ts
 *
 * The exec can now record the time-of-day an event runs (e.g. 6–8pm), not just
 * its date. These columns are declared in `src/db/schema.ts` but must be added
 * to the live DB by hand. Additive, nullable, `IF NOT EXISTS` — safe to re-run.
 *
 * NOTE: dsec-api owns the core schema via Alembic; these app-owned columns are
 * added here by hand (never via `alembic --autogenerate`, which can emit
 * destructive DROPs against the live Neon database).
 */
import { config } from "dotenv";

config({ path: ".env.local" });

const DDL = `
ALTER TABLE events ADD COLUMN IF NOT EXISTS start_time time;
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_time time;
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
    console.log("Adding events.start_time / events.end_time columns (idempotent)…");
    await pool.query(DDL);

    const { rows } = await pool.query(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_name = 'events' AND column_name IN ('start_time', 'end_time')
       ORDER BY column_name`,
    );
    console.log("Done. events time columns:");
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
