/**
 * One-time (idempotent) migration: add the per-role `write_modules` column to
 * `app_role` so a role can grant *read-only* access to a module independently of
 * write.
 *
 *   npx tsx scripts/add-role-write-modules.ts
 *
 * `modules` stays the read/access set; `write_modules` is the subset a role may
 * also edit (write ⊆ read). On first add we backfill `write_modules = modules`
 * so every existing role keeps its current full read+write access — admins can
 * then dial individual sections back to view-only in the role editor.
 *
 * The backfill runs ONLY when the column is first created (guarded DO block), so
 * a legitimately-empty write set (e.g. an Auditor / Viewer role) is never
 * re-backfilled on a re-run. Additive + idempotent — safe to re-run.
 *
 * NOTE: dsec-api owns the core schema via Alembic; this RBAC column is app-owned
 * and added here by hand (never via `alembic --autogenerate`, which can emit
 * destructive DROPs against the live Neon database).
 */
import { config } from "dotenv";

config({ path: ".env.local" });

const DDL = `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_role' AND column_name = 'write_modules'
  ) THEN
    ALTER TABLE app_role ADD COLUMN write_modules json NOT NULL DEFAULT '[]';
    -- Preserve everyone's current full access (every granted module was editable).
    UPDATE app_role SET write_modules = modules;
  END IF;
END $$;
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
    console.log("Adding app_role.write_modules (idempotent)…");
    await pool.query(DDL);

    const { rows } = await pool.query(
      `SELECT name, modules, write_modules, is_system
       FROM app_role ORDER BY is_system DESC, name`,
    );
    console.log("Done. Roles now carry read (modules) + write (write_modules):");
    for (const r of rows) {
      console.log(
        `  • ${r.name}${r.is_system ? " (system)" : ""}  read=${JSON.stringify(r.modules)}  write=${JSON.stringify(r.write_modules)}`,
      );
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
