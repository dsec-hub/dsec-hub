/**
 * Apply the persona-driven dashboard views to the built-in roles.
 *
 *   npx tsx scripts/apply-role-dashboards.ts          # show what would change
 *   npx tsx scripts/apply-role-dashboards.ts --write  # apply
 *
 * Unlike `setup-roles-v2.ts` (which only seeds view_config when it's empty, so
 * it never clobbers an admin's customisation), this script FORCE-RESETS each
 * built-in role's view_config to the canonical persona dashboard. Run it to roll
 * out (or restore) the designed per-role dashboards. It only touches the 15
 * known role names — any custom role is left untouched.
 *
 * App-owned (app_role) — applied by hand, NEVER via alembic autogenerate.
 * KEEP IN SYNC with src/lib/dashboard-config.ts ROLE_DEFAULTS + setup-roles-v2.ts.
 */
import { config } from "dotenv";

config({ path: ".env.local" });

type View = { land: string; view: string; sections: string[] };

// Roles whose committeeScope is "all" (see every committee's meetings/notes).
const ALL_SCOPE = new Set(["admin", "exec", "secretary", "auditor"]);

// Keyed by lower-cased role name. Sections are listed in CANONICAL_SECTIONS order.
const VIEWS: Record<string, View> = {
  admin: { land: "/dashboard", view: "all-tasks", sections: ["tasks_due_soon", "upcoming_events", "sponsor_pipeline", "committee_health", "finance_summary"] },
  exec: { land: "/dashboard", view: "by-committee", sections: ["my_work", "upcoming_events", "sponsor_pipeline", "committee_health", "finance_summary"] },
  secretary: { land: "/meetings", view: "my-work", sections: ["my_work", "action_items", "upcoming_meetings", "recent_documents"] },
  "external affairs lead": { land: "/dashboard", view: "by-committee", sections: ["my_work", "action_items", "upcoming_events", "sponsor_pipeline", "partners"] },
  "external affairs member": { land: "/dashboard", view: "my-work", sections: ["my_work", "action_items", "upcoming_meetings", "sponsor_pipeline", "partners"] },
  "marketing lead": { land: "/dashboard", view: "by-committee", sections: ["my_work", "tasks_due_soon", "action_items", "upcoming_events", "committee_health"] },
  "marketing member": { land: "/dashboard", view: "my-work", sections: ["my_work", "action_items", "upcoming_events", "upcoming_meetings"] },
  "design lead": { land: "/dashboard", view: "by-committee", sections: ["my_work", "action_items", "upcoming_events", "committee_health", "recent_documents"] },
  "design member": { land: "/tasks", view: "my-work", sections: ["my_work", "action_items", "upcoming_events", "upcoming_meetings"] },
  "development lead": { land: "/dashboard", view: "by-committee", sections: ["my_work", "action_items", "upcoming_meetings", "active_projects", "committee_health"] },
  "development member": { land: "/projects", view: "my-work", sections: ["my_work", "upcoming_events", "upcoming_meetings", "active_projects"] },
  "general member": { land: "/tasks", view: "my-work", sections: ["my_work", "upcoming_events", "upcoming_meetings"] },
  treasurer: { land: "/finance", view: "my-work", sections: ["finance_summary", "expense_breakdown", "event_budgets"] },
  auditor: { land: "/finance", view: "by-committee", sections: ["my_work", "sponsor_pipeline", "finance_summary", "expense_breakdown", "event_budgets"] },
  viewer: { land: "/dashboard", view: "my-work", sections: [] },
};

function buildViewConfig(key: string, v: View) {
  return {
    version: 1,
    sections: Object.fromEntries(v.sections.map((id) => [id, true])),
    landingPath: v.land,
    defaultTaskView: v.view,
    committeeScope: ALL_SCOPE.has(key) ? "all" : "own",
  };
}

// Canonical render order (mirrors CANONICAL_SECTIONS) — used only to print the
// section lists in a stable order. Postgres jsonb does NOT preserve key order,
// so change-detection compares SETS, not the stored key order.
const ORDER = [
  "my_work", "tasks_due_soon", "action_items", "upcoming_events", "upcoming_meetings",
  "active_projects", "sponsor_pipeline", "partners", "committee_health", "membership",
  "finance_summary", "expense_breakdown", "event_budgets", "recent_documents",
];
const inOrder = (ids: string[]) => [...ids].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");

function sectionsOf(viewConfig: unknown): string[] {
  const s = (viewConfig as { sections?: Record<string, boolean> } | null)?.sections;
  if (!s || typeof s !== "object") return [];
  return Object.entries(s).filter(([, on]) => on).map(([id]) => id);
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
      `SELECT id, name, view_config FROM app_role`,
    );
    const byName = new Map(rows.map((r) => [String(r.name).toLowerCase(), r]));

    console.log(write ? "APPLYING persona dashboards…\n" : "DRY RUN (pass --write to apply)\n");
    let changed = 0;
    let missing = 0;

    for (const [key, v] of Object.entries(VIEWS)) {
      const row = byName.get(key);
      if (!row) {
        console.log(`  · ${key} — role not found, skipped`);
        missing += 1;
        continue;
      }
      const beforeIds = sectionsOf(row.view_config);
      const next = buildViewConfig(key, v);
      const same = sameSet(beforeIds, v.sections); // set equality (order-agnostic)
      const before = inOrder(beforeIds).join(", ") || "(none)";
      const after = inOrder(v.sections).join(", ") || "(none)";
      console.log(`  ${same ? "=" : "~"} ${row.name}`);
      console.log(`      land=${v.land}  view=${v.view}  scope=${next.committeeScope}`);
      console.log(`      sections: ${before}  ->  ${after}`);
      if (write) {
        await pool.query(`UPDATE app_role SET view_config = $2::jsonb, updated_at = now() WHERE id = $1`, [
          row.id,
          JSON.stringify(next),
        ]);
      }
      if (!same) changed += 1;
    }

    console.log(
      `\n${write ? "Applied" : "Would change"} ${changed} role${changed === 1 ? "" : "s"}` +
        (missing ? ` (${missing} not found)` : "") +
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
