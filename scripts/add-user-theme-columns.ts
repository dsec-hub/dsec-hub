/**
 * One-time (idempotent) migration: add the per-user Appearance theme columns to
 * `app_user`.
 *
 *   npx tsx scripts/add-user-theme-columns.ts
 *
 * These columns are declared in `src/db/schema.ts` and read by `getCurrentUser`
 * (src/lib/dal.ts), but were never added to the live DB — so the auth lookup
 * fails with `column app_user.theme_font_title does not exist` and every gated
 * page 500s. Additive, nullable, `IF NOT EXISTS` — safe to re-run.
 *
 * NOTE: dsec-api owns the core schema via Alembic; these app-owned user columns
 * are added here by hand (never via `alembic --autogenerate`, which can emit
 * destructive DROPs against the live Neon database).
 */
import { config } from "dotenv";

config({ path: ".env.local" });

const DDL = `
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS theme_accent       varchar(16);
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS theme_background   varchar(16);
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS theme_font_title   varchar(32);
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS theme_font_body    varchar(32);
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS theme_weight_title varchar(16);
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS theme_weight_body  varchar(16);
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
    console.log("Adding app_user theme columns (idempotent)…");
    await pool.query(DDL);

    const { rows } = await pool.query(
      `SELECT column_name, data_type, character_maximum_length
       FROM information_schema.columns
       WHERE table_name = 'app_user' AND column_name LIKE 'theme_%'
       ORDER BY column_name`,
    );
    console.log("Done. app_user theme columns now present:");
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
