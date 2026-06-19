/**
 * One-time (idempotent) migration: add the `role_title` column to `app_invite`.
 *
 *   npx tsx scripts/add-invite-role-title-column.ts
 *
 * Admins can now set the invitee's position / title (e.g. "Events Lead") at
 * invite time; it's applied to their People record — seeded immediately when a
 * name is given, else on acceptance. Distinct from `role_id` (the RBAC role).
 * Mirrors people.role_title. This column is declared in `src/db/schema.ts` but
 * must be added to the live DB by hand. Additive, nullable, `IF NOT EXISTS` —
 * safe to re-run.
 *
 * NOTE: dsec-api owns the core schema via Alembic; these app-owned columns are
 * added here by hand (never via `alembic --autogenerate`, which can emit
 * destructive DROPs against the live Neon database).
 */
import { config } from "dotenv";

config({ path: ".env.local" });

const DDL = `
ALTER TABLE app_invite ADD COLUMN IF NOT EXISTS role_title varchar(128);
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
    console.log("Adding app_invite.role_title column (idempotent)…");
    await pool.query(DDL);

    const { rows } = await pool.query(
      `SELECT column_name, data_type, character_maximum_length
       FROM information_schema.columns
       WHERE table_name = 'app_invite' AND column_name = 'role_title'`,
    );
    console.log("Done. app_invite.role_title:");
    for (const r of rows) {
      console.log(`  • ${r.column_name} (${r.data_type}${r.character_maximum_length ? `(${r.character_maximum_length})` : ""})`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
