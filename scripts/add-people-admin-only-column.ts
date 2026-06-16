/**
 * One-time (idempotent) migration: add `admin_only` to `people`.
 *
 *   npx tsx scripts/add-people-admin-only-column.ts
 *
 * When true, only admin users see this person in the internal app (People list
 * + detail) — lets the exec keep sensitive contacts off the general committee's
 * view. This column is declared in `src/db/schema.ts` but must be added to the
 * live DB by hand. Additive, defaulted, `IF NOT EXISTS` — safe to re-run.
 *
 * NOTE: dsec-api owns the core schema via Alembic; these app-owned columns are
 * added here by hand (never via `alembic --autogenerate`, which can emit
 * destructive DROPs against the live Neon database).
 */
import { config } from "dotenv";

config({ path: ".env.local" });

const DDL = `
ALTER TABLE people ADD COLUMN IF NOT EXISTS admin_only boolean NOT NULL DEFAULT false;
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
    console.log("Adding people.admin_only column (idempotent)…");
    await pool.query(DDL);

    const { rows } = await pool.query(
      `SELECT column_name, data_type, column_default
       FROM information_schema.columns
       WHERE table_name = 'people' AND column_name = 'admin_only'`,
    );
    console.log("Done. people.admin_only:");
    for (const r of rows) {
      console.log(`  • ${r.column_name} (${r.data_type}) default ${r.column_default}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
