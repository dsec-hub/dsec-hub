/**
 * One-time (idempotent) migration: add `onboarding_completed_at` to `app_user`.
 *
 *   npx tsx scripts/add-user-onboarding-column.ts
 *
 * Null means the member hasn't finished the first-run onboarding wizard; the
 * (app) layout forces them to /onboarding until it is set. EXISTING accounts are
 * backfilled to now() so only NEW accounts (and anyone an admin resets) are sent
 * through onboarding. This column is declared in `src/db/schema.ts` but must be
 * added to the live DB by hand. Additive, `IF NOT EXISTS` — safe to re-run.
 *
 * NOTE: dsec-api owns the core schema via Alembic; these app-owned columns are
 * added here by hand (never via `alembic --autogenerate`, which can emit
 * destructive DROPs against the live Neon database).
 */
import { config } from "dotenv";

config({ path: ".env.local" });

const DDL = `
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;
`;

// Only stamp rows that are still null AND existed before this migration. Since
// the column is created null, every current row is null here — exactly the set
// of pre-existing accounts we want to mark "already onboarded".
const BACKFILL = `
UPDATE app_user SET onboarding_completed_at = now() WHERE onboarding_completed_at IS NULL;
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
    console.log("Adding app_user.onboarding_completed_at column (idempotent)…");
    await pool.query(DDL);

    const res = await pool.query(BACKFILL);
    console.log(`Backfilled ${res.rowCount} existing user(s) as already onboarded.`);

    const { rows } = await pool.query(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_name = 'app_user' AND column_name = 'onboarding_completed_at'`,
    );
    console.log("Done. app_user.onboarding_completed_at:");
    for (const r of rows) {
      console.log(`  • ${r.column_name} (${r.data_type}) nullable=${r.is_nullable}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
