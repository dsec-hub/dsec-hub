/**
 * One-time (idempotent) grant: give the new `scan` module (the /scan QR wall) to
 * every role that already manages the Link Tree (`links`) — same people, same
 * access. Grants it to both `modules` (read/access) and `write_modules` (edit),
 * matching each role's existing links access (read-only roles get read-only scan).
 *
 *   npx tsx scripts/grant-scan-module.ts
 *
 * Admins are superusers (they see every module implicitly), so they need no row.
 * Additive + idempotent — re-running never duplicates the grant.
 *
 * NOTE: dsec-api owns the core schema via Alembic; this RBAC grant is app-owned
 * and applied here by hand (never via `alembic --autogenerate`).
 */
import { config } from "dotenv";

config({ path: ".env.local" });

function withModule(list: unknown, has: string, add: string): { next: string[]; changed: boolean } {
  const arr = Array.isArray(list) ? (list as string[]) : [];
  if (arr.includes(has) && !arr.includes(add)) return { next: [...arr, add], changed: true };
  return { next: arr, changed: false };
}

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
    const { rows } = await pool.query(
      `SELECT id, name, modules, write_modules FROM app_role ORDER BY name`,
    );
    let updated = 0;
    for (const r of rows) {
      const read = withModule(r.modules, "links", "scan");
      const write = withModule(r.write_modules, "links", "scan");
      if (!read.changed && !write.changed) continue;
      await pool.query(`UPDATE app_role SET modules = $1, write_modules = $2 WHERE id = $3`, [
        JSON.stringify(read.next),
        JSON.stringify(write.next),
        r.id,
      ]);
      updated += 1;
      console.log(`  • granted scan to "${r.name}" (read=${read.changed}, write=${write.changed})`);
    }
    console.log(
      updated
        ? `Done. Granted scan to ${updated} role(s) that had links.`
        : "No changes — every links-role already has scan (or no role has links).",
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
