/**
 * One-time (idempotent) migration: add the per-role `view_config` JSONB column
 * to `app_role` (the "Focus" layer — see db/schema.ts ViewConfig).
 *
 *   npx tsx scripts/add-app-role-view-config-column.ts
 *
 * `view_config` holds presentation-only config (dashboard sections, landing
 * path, default task view, nav order). It NEVER grants access beyond `modules`.
 * Nullable column + a backfill so no role is left NULL mid-rollback; the DAL
 * additionally normalises null/legacy shapes to a safe default (belt & braces).
 *
 * Additive + idempotent — safe to re-run.
 *
 * NOTE: dsec-api owns the core schema via Alembic; this RBAC column is app-owned
 * and added here by hand (never via `alembic --autogenerate`, which can emit
 * destructive DROPs against the live Neon database).
 */
import { config } from "dotenv";

config({ path: ".env.local" });

const DDL = `
ALTER TABLE app_role ADD COLUMN IF NOT EXISTS view_config jsonb DEFAULT NULL;
UPDATE app_role
   SET view_config = '{"version":1,"sections":{}}'::jsonb
 WHERE view_config IS NULL;
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
    console.log("Adding app_role.view_config (idempotent)…");
    await pool.query(DDL);

    const { rows } = await pool.query(
      `SELECT name, view_config FROM app_role ORDER BY is_system DESC, name`,
    );
    console.log("Done. Roles now carry view_config:");
    for (const r of rows) {
      console.log(`  • ${r.name}  view_config=${JSON.stringify(r.view_config)}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
