/**
 * One-time (idempotent) migration: per-user privilege overrides on top of a
 * user's role. `extra_modules` adds extra READ access; `extra_write_modules`
 * adds extra EDIT access — both UNION-ed with the role at read time (see dal.ts).
 *
 *   npx tsx scripts/add-app-user-extra-privileges.ts
 *
 * Elevate-only: a user gets their role's access PLUS these extras (e.g. give the
 * Design Lead the events module without changing the Design Lead role for
 * everyone). The "admin" superuser flag is intentionally NOT grantable here — it
 * stays role-only so the last-active-admin lockout guard remains valid.
 *
 * Additive + idempotent. App-owned column — applied by hand, never via
 * `alembic --autogenerate` (which can emit destructive DROPs against Neon).
 */
import { config } from "dotenv";

config({ path: ".env.local" });

const DDL = `
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS extra_modules json NOT NULL DEFAULT '[]';
ALTER TABLE app_user ADD COLUMN IF NOT EXISTS extra_write_modules json NOT NULL DEFAULT '[]';
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
    console.log("Adding app_user.extra_modules + extra_write_modules (idempotent)…");
    await pool.query(DDL);
    const { rows } = await pool.query(
      `SELECT count(*) filter (where extra_modules::jsonb <> '[]') as with_extras FROM app_user`,
    );
    console.log(`Done. Users with custom privileges: ${rows[0].with_extras}.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
