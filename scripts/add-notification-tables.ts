/**
 * One-time (idempotent) migration: create the app-owned notification tables.
 *
 *   npx tsx scripts/add-notification-tables.ts
 *
 * These back the per-user notification settings (/settings/notifications) and
 * the on-assign + due-soon delivery across Email / Discord / Telegram. They are
 * declared in `src/db/schema.ts` (notificationPref / notificationLog).
 *
 * NOTE: dsec-api owns the core schema via Alembic; these hub-owned tables are
 * created here by hand (never via `alembic --autogenerate`, which can emit
 * destructive DROPs against the live Neon database). Additive + `IF NOT EXISTS`,
 * so it is safe to re-run.
 */
import { config } from "dotenv";

config({ path: ".env.local" });

const DDL = `
CREATE TABLE IF NOT EXISTS notification_pref (
  id                  serial PRIMARY KEY,
  user_id             integer NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  email_enabled       boolean NOT NULL DEFAULT true,
  email_address       varchar(256),
  discord_enabled     boolean NOT NULL DEFAULT false,
  discord_webhook_url text,
  telegram_enabled    boolean NOT NULL DEFAULT false,
  telegram_chat_id    varchar(32),
  telegram_link_code  varchar(32),
  telegram_linked_at  timestamptz,
  notify_on_assign    boolean NOT NULL DEFAULT true,
  notify_due_digest   boolean NOT NULL DEFAULT true,
  notify_due_reminder boolean NOT NULL DEFAULT true,
  due_soon_days       integer NOT NULL DEFAULT 3,
  reminder_lead_days  integer NOT NULL DEFAULT 1,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ix_notification_pref_user_id ON notification_pref (user_id);

CREATE TABLE IF NOT EXISTS notification_log (
  id         serial PRIMARY KEY,
  user_id    integer NOT NULL,
  channel    varchar(16) NOT NULL,
  kind       varchar(32) NOT NULL,
  task_id    integer,
  dedupe_key varchar(256) NOT NULL,
  status     varchar(16) NOT NULL,
  detail     varchar(512),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ix_notification_log_dedupe_key ON notification_log (dedupe_key);
CREATE INDEX IF NOT EXISTS ix_notification_log_user_id ON notification_log (user_id);
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
    console.log("Creating notification tables (idempotent)…");
    await pool.query(DDL);

    const { rows } = await pool.query(
      `SELECT table_name, count(*)::int AS columns
       FROM information_schema.columns
       WHERE table_name IN ('notification_pref', 'notification_log')
       GROUP BY table_name
       ORDER BY table_name`,
    );
    console.log("Done. Notification tables present:");
    for (const r of rows) {
      console.log(`  • ${r.table_name} (${r.columns} columns)`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
