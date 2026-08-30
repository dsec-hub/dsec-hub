/**
 * Backfill an EXPLICIT committeeScope onto every app_role's view_config.
 *
 *   npx tsx scripts/backfill-role-committee-scope.ts          # show what would change
 *   npx tsx scripts/backfill-role-committee-scope.ts --write  # apply
 *
 * Until now committeeScope was never stored on most roles — it was GUESSED from
 * the role's name at read time (defaultCommitteeScope). Two things follow: an
 * admin renaming a role silently flips its cross-committee visibility, and the
 * role editor wipes any committeeScope that WAS stored. Before the editor learns
 * to persist the field (and the read-time fallback stops trusting the name), we
 * write the CURRENT effective value onto every row so nobody's access changes.
 *
 * For each app_role row:
 *   • if view_config already has an explicit committeeScope → leave it untouched;
 *   • otherwise set it to defaultCommitteeScope(role.name) — exactly what the app
 *     resolves today, so this changes nobody's access;
 *   • navOrder is NOT invented — if it is absent it stays absent.
 *
 * This is a DATA change only. There is NO schema migration — dsec-hub does not
 * own the schema (drizzle.config.ts is introspect-only; dsec-api's Alembic owns
 * it). Do not add a Drizzle migration.
 *
 * App-owned (app_role) — applied by hand, NEVER via alembic autogenerate.
 */
import { config } from "dotenv";

import { defaultCommitteeScope, getDefaultViewConfig } from "../src/lib/dashboard-config";
import type { ViewConfig } from "../src/db/schema";

config({ path: ".env.local" });

type Backfill = {
  next: ViewConfig;
  changed: boolean;
  before: "all" | "own" | "(none)";
  after: "all" | "own";
};

/** Resolve the row's new view_config, adding an explicit committeeScope only
 * where one is missing. A null / non-object view_config is replaced with the
 * role's full default (which normalizeViewConfig already resolves it to today,
 * so this is behaviour-preserving). */
function backfill(view: unknown, roleName: string | null): Backfill {
  const after = defaultCommitteeScope(roleName);
  if (view && typeof view === "object" && !Array.isArray(view)) {
    const vc = view as ViewConfig & { committeeScope?: unknown };
    if (vc.committeeScope === "all" || vc.committeeScope === "own") {
      return { next: vc, changed: false, before: vc.committeeScope, after };
    }
    return { next: { ...vc, committeeScope: after }, changed: true, before: "(none)", after };
  }
  return { next: getDefaultViewConfig(roleName), changed: true, before: "(none)", after };
}

async function main() {
  const write = process.argv.includes("--write");
  const { Pool } = await import("pg");
  const url = new URL(process.env.DATABASE_URL ?? "");
  const needsSsl = url.searchParams.get("sslmode") === "require";
  url.searchParams.delete("sslmode");
  const pool = new Pool({ connectionString: url.toString(), ssl: needsSsl ? { rejectUnauthorized: true } : undefined });

  try {
    const { rows } = await pool.query<{ id: number; name: string; view_config: unknown }>(
      `SELECT id, name, view_config FROM app_role ORDER BY is_system DESC, name`,
    );

    console.log(write ? "APPLYING committeeScope backfill…\n" : "DRY RUN (pass --write to apply)\n");
    let changed = 0;

    for (const row of rows) {
      const b = backfill(row.view_config, row.name);
      console.log(`  ${b.changed ? "~" : "="} ${row.name}`);
      console.log(`      committeeScope: ${b.before}  ->  ${b.after}`);
      if (write && b.changed) {
        await pool.query(`UPDATE app_role SET view_config = $2::jsonb, updated_at = now() WHERE id = $1`, [
          row.id,
          JSON.stringify(b.next),
        ]);
      }
      if (b.changed) changed += 1;
    }

    console.log(
      `\n${write ? "Applied" : "Would change"} ${changed} role${changed === 1 ? "" : "s"}` +
        (write ? "." : ". Re-run with --write to apply."),
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
