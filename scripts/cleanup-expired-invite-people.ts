/**
 * Roster cleanup for abandoned invites — archive the provisional /people rows
 * that admin-named invites created when those invites expire without being
 * accepted.
 *
 *   npx tsx scripts/cleanup-expired-invite-people.ts
 *
 * The running app already does this opportunistically whenever an admin creates
 * or revokes an invite (see lib/person-link.ts → cleanupExpiredInvitePeople).
 * Run this on a schedule (e.g. daily cron) to guarantee cleanup even when no
 * admin touches the invites page.
 *
 * Safe by construction:
 *   • only touches invites that are still `pending`, past `expires_at`, and hold
 *     a `person_id` (i.e. they created that roster row);
 *   • never archives a person a login (`app_user`) has adopted — that's a real
 *     member now;
 *   • archive is a reversible soft delete (`archived = true`), not a hard delete;
 *   • clears `person_id` afterwards so re-runs are no-ops. Idempotent.
 *
 * NOTE: dsec-api owns the core schema via Alembic; this is app-owned bookkeeping
 * over the `app_invite` / `people` tables.
 */
import { config } from "dotenv";

config({ path: ".env.local" });

// Archive unadopted people seeded by expired, still-pending invites.
const ARCHIVE = `
UPDATE people p
SET archived = true, updated_at = now()
WHERE p.archived = false
  AND p.id IN (
    SELECT i.person_id
    FROM app_invite i
    WHERE i.status = 'pending'
      AND i.expires_at < now()
      AND i.person_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM app_user u WHERE u.person_id = i.person_id)
  );
`;

// Drop the bookkeeping link so the work isn't repeated (covers both archived
// rows and any we skipped because a login had adopted them).
const UNLINK = `
UPDATE app_invite
SET person_id = NULL
WHERE status = 'pending' AND expires_at < now() AND person_id IS NOT NULL;
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

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const archived = await client.query(ARCHIVE);
    const unlinked = await client.query(UNLINK);
    await client.query("COMMIT");
    console.log(`Archived ${archived.rowCount} ghost person(s); cleared ${unlinked.rowCount} invite link(s).`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
