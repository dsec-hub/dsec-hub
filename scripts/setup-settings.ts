/**
 * One-time (idempotent) setup for the dsec-app site-settings store.
 *
 *   npx tsx scripts/setup-settings.ts
 *
 * Creates the `app_setting` key/value table used by the Settings page to hold
 * global config such as the public social links. Safe to re-run.
 *
 * NOTE: dsec-api owns the core schema via Alembic. This table is app-owned and
 * intentionally created here rather than in an Alembic migration (mirrors
 * scripts/setup-roles.ts).
 */
import { config } from "dotenv";

config({ path: ".env.local" });

const DDL = `
CREATE TABLE IF NOT EXISTS app_setting (
  key        varchar(128) PRIMARY KEY,
  value      text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
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
    console.log("Creating app_setting table…");
    await pool.query(DDL);
    console.log("Done.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
