/**
 * One-time (idempotent) migration: add the `person_id` column to `app_invite`.
 *
 *   npx tsx scripts/add-invite-person-id-column.ts
 *
 * Records the People row an invite *created* when an admin set a name (see
 * createInvite / ensurePersonForInvite). It stays null when the invite adopted
 * an existing member or no name was given. Revoke + expiry cleanup use it to
 * archive the provisional roster row without touching real members. This column
 * is declared in `src/db/schema.ts` but must be added to the live DB by hand.
 * Additive, nullable, `IF NOT EXISTS` — safe to re-run.
 *
 * NOTE: dsec-api owns the core schema via Alembic; these app-owned columns are
 * added here by hand (never via `alembic --autogenerate`, which can emit
 * destructive DROPs against the live Neon database).
 */
import { config } from "dotenv";

config({ path: ".env.local" });

const DDL = `
ALTER TABLE app_invite ADD COLUMN IF NOT EXISTS person_id integer;
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
    console.log("Adding app_invite.person_id column (idempotent)…");
    await pool.query(DDL);

    const { rows } = await pool.query(
      `SELECT column_name, data_type
       FROM information_schema.columns
       WHERE table_name = 'app_invite' AND column_name = 'person_id'`,
    );
    console.log("Done. app_invite.person_id:");
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
