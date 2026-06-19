/**
 * One-time (idempotent) migration: add the `name` column to `app_invite`.
 *
 *   npx tsx scripts/add-invite-name-column.ts
 *
 * Admins can now set a display name when inviting someone. When provided, a
 * People record is created immediately so the invitee appears in /people before
 * they accept, and the accept form prefills the name. This column is declared in
 * `src/db/schema.ts` but must be added to the live DB by hand. Additive,
 * nullable, `IF NOT EXISTS` — safe to re-run.
 *
 * NOTE: dsec-api owns the core schema via Alembic; these app-owned columns are
 * added here by hand (never via `alembic --autogenerate`, which can emit
 * destructive DROPs against the live Neon database).
 */
import { config } from "dotenv";

config({ path: ".env.local" });

const DDL = `
ALTER TABLE app_invite ADD COLUMN IF NOT EXISTS name varchar(256);
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
    console.log("Adding app_invite.name column (idempotent)…");
    await pool.query(DDL);

    const { rows } = await pool.query(
      `SELECT column_name, data_type, character_maximum_length
       FROM information_schema.columns
       WHERE table_name = 'app_invite' AND column_name = 'name'`,
    );
    console.log("Done. app_invite.name:");
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
