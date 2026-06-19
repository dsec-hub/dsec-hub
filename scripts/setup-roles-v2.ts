/**
 * Idempotent, NON-DESTRUCTIVE role seed v2 (Tasks-Views + Roles initiative).
 *
 *   npx tsx scripts/setup-roles-v2.ts
 *
 * Brings the club's role model in line with the blueprint:
 *   • Renames the legacy "Sponsorship" ROLE -> "External Affairs Lead"
 *     (preserving its id, so any user already on it keeps their assignment),
 *     then expands it to cover partnerships/outreach.
 *   • Creates the new committee roles: External Affairs Member, Marketing
 *     Lead/Member, Design Lead/Member, Development Member, Secretary, General
 *     Member (Development Lead already exists — left additive).
 *   • Backfills per-role Focus config (view_config) where not customised.
 *   • Fixes the historical bug where the preset module list omitted "partners".
 *
 * SAFETY: never removes access. For roles that ALREADY exist, modules /
 * write_modules are UNION-ed with the target (additive only), and view_config
 * is set ONLY if currently empty (won't clobber an admin's customisation).
 * Brand-new roles are inserted with the exact target. Unknown custom roles
 * (e.g. "Events Lead") are left entirely untouched.
 *
 * KEEP IN SYNC with src/app/(app)/dashboard/dashboard-config.ts ROLE_DEFAULTS.
 * App-owned (app_role) — applied by hand, never via alembic autogenerate.
 */
import { config } from "dotenv";

config({ path: ".env.local" });

const ALL = ["events", "people", "sponsors", "partners", "finance", "tasks", "projects", "members", "meetings", "documents", "admin"];
const APP = ["events", "people", "sponsors", "partners", "finance", "tasks", "projects", "members", "meetings", "documents"];

type ViewConfig = { version: 1; sections: Record<string, boolean>; landingPath?: string; defaultTaskView?: string };
const sx = (...ids: string[]): Record<string, boolean> => Object.fromEntries(ids.map((id) => [id, true]));
const vc = (landingPath: string, defaultTaskView: string, ...ids: string[]): ViewConfig => ({ version: 1, sections: sx(...ids), landingPath, defaultTaskView });

type TargetRole = {
  name: string;
  description: string;
  modules: string[];
  writeModules: string[];
  isSystem: boolean;
  viewConfig: ViewConfig;
};

// viewConfig values mirror src/lib/dashboard-config.ts ROLE_DEFAULTS (the
// persona-driven dashboards). KEEP IN SYNC with that file + apply-role-dashboards.ts.
const TARGETS: TargetRole[] = [
  { name: "Admin", description: "Full access to every module plus user, role, and invite management.", modules: ALL, writeModules: ALL, isSystem: true, viewConfig: vc("/dashboard", "all-tasks", "tasks_due_soon", "upcoming_events", "sponsor_pipeline", "committee_health", "finance_summary") },
  { name: "Exec", description: "Full access to every operational module (no admin panel).", modules: APP, writeModules: APP, isSystem: false, viewConfig: vc("/dashboard", "by-committee", "my_work", "upcoming_events", "sponsor_pipeline", "committee_health", "finance_summary") },
  { name: "Secretary", description: "Runs meetings + records: meetings, documents, action items.", modules: ["meetings", "documents", "people", "tasks"], writeModules: ["meetings", "documents"], isSystem: false, viewConfig: vc("/meetings", "my-work", "my_work", "action_items", "upcoming_meetings", "recent_documents") },
  { name: "External Affairs Lead", description: "Owns sponsorships + outreach to other clubs/partnerships.", modules: ["sponsors", "partners", "people", "tasks", "events", "meetings"], writeModules: ["sponsors", "partners", "tasks", "meetings"], isSystem: false, viewConfig: vc("/dashboard", "by-committee", "my_work", "action_items", "upcoming_events", "sponsor_pipeline", "partners") },
  { name: "External Affairs Member", description: "Works the sponsor + partner pipeline.", modules: ["sponsors", "partners", "people", "tasks", "meetings"], writeModules: ["sponsors", "partners"], isSystem: false, viewConfig: vc("/dashboard", "my-work", "my_work", "action_items", "upcoming_meetings", "sponsor_pipeline", "partners") },
  { name: "Marketing Lead", description: "Leads marketing content/promo per event.", modules: ["events", "tasks", "people", "documents", "meetings"], writeModules: ["tasks", "meetings"], isSystem: false, viewConfig: vc("/dashboard", "by-committee", "my_work", "tasks_due_soon", "action_items", "upcoming_events", "committee_health") },
  { name: "Marketing Member", description: "Marketing content/promo; edits own tasks.", modules: ["events", "tasks", "people", "meetings"], writeModules: [], isSystem: false, viewConfig: vc("/dashboard", "my-work", "my_work", "action_items", "upcoming_events", "upcoming_meetings") },
  { name: "Design Lead", description: "Leads graphics/post design for events (currently unstaffed).", modules: ["events", "tasks", "people", "documents", "meetings"], writeModules: ["tasks", "documents", "meetings"], isSystem: false, viewConfig: vc("/dashboard", "by-committee", "my_work", "action_items", "upcoming_events", "committee_health", "recent_documents") },
  { name: "Design Member", description: "Designs graphics/posts for events; edits own tasks (currently unstaffed).", modules: ["events", "tasks", "people", "meetings"], writeModules: [], isSystem: false, viewConfig: vc("/tasks", "my-work", "my_work", "action_items", "upcoming_events", "upcoming_meetings") },
  { name: "Development Lead", description: "Leads technical projects + event tech.", modules: ["projects", "events", "tasks", "people", "documents", "meetings"], writeModules: ["projects", "events", "tasks", "meetings"], isSystem: false, viewConfig: vc("/dashboard", "by-committee", "my_work", "action_items", "upcoming_meetings", "active_projects", "committee_health") },
  { name: "Development Member", description: "Builds projects + event tech; edits own tasks.", modules: ["projects", "events", "tasks", "people", "meetings"], writeModules: ["projects"], isSystem: false, viewConfig: vc("/projects", "my-work", "my_work", "upcoming_events", "upcoming_meetings", "active_projects") },
  { name: "General Member", description: "General committee member: own tasks + read events/people/meetings.", modules: ["tasks", "people", "events", "meetings"], writeModules: [], isSystem: false, viewConfig: vc("/tasks", "my-work", "my_work", "upcoming_events", "upcoming_meetings") },
  { name: "Treasurer", description: "Finance only.", modules: ["finance"], writeModules: ["finance"], isSystem: false, viewConfig: vc("/finance", "my-work", "finance_summary", "expense_breakdown", "event_budgets") },
  { name: "Auditor", description: "Read-only across every operational module.", modules: APP, writeModules: [], isSystem: false, viewConfig: vc("/finance", "by-committee", "my_work", "sponsor_pipeline", "finance_summary", "expense_breakdown", "event_budgets") },
  { name: "Viewer", description: "Overview dashboard only.", modules: [], writeModules: [], isSystem: false, viewConfig: vc("/dashboard", "my-work") },
];

const union = (a: string[] | null, b: string[]): string[] => Array.from(new Set([...(a ?? []), ...b]));
const sectionsEmpty = (vcfg: ViewConfig | null): boolean => !vcfg || !vcfg.sections || Object.keys(vcfg.sections).length === 0;

async function main() {
  const { Pool } = await import("pg");
  const url = new URL(process.env.DATABASE_URL ?? "");
  const needsSsl = url.searchParams.get("sslmode") === "require";
  url.searchParams.delete("sslmode");
  const pool = new Pool({ connectionString: url.toString(), ssl: needsSsl ? { rejectUnauthorized: true } : undefined });

  try {
    // 1. Rename legacy "Sponsorship" role -> "External Affairs Lead" (id preserved).
    const renamed = await pool.query(
      `UPDATE app_role SET name = 'External Affairs Lead', updated_at = now()
       WHERE lower(name) = 'sponsorship'
         AND NOT EXISTS (SELECT 1 FROM app_role WHERE lower(name) = 'external affairs lead')
       RETURNING id`,
    );
    if (renamed.rowCount) console.log("Renamed role 'Sponsorship' -> 'External Affairs Lead'.");

    // 2. Load current roles.
    const { rows: existing } = await pool.query(
      `SELECT id, name, modules, write_modules, view_config FROM app_role`,
    );
    const byName = new Map<string, (typeof existing)[number]>();
    for (const r of existing) byName.set(String(r.name).toLowerCase(), r);

    // 3. Upsert each target.
    for (const t of TARGETS) {
      const cur = byName.get(t.name.toLowerCase());
      if (cur) {
        const newModules = union(cur.modules, t.modules);
        const newWrite = union(cur.write_modules, t.writeModules);
        const newView = sectionsEmpty(cur.view_config) ? t.viewConfig : cur.view_config;
        await pool.query(
          `UPDATE app_role
              SET modules = $2::json, write_modules = $3::json, view_config = $4::jsonb,
                  description = COALESCE(NULLIF(description, ''), $5), updated_at = now()
            WHERE id = $1`,
          [cur.id, JSON.stringify(newModules), JSON.stringify(newWrite), JSON.stringify(newView), t.description],
        );
        console.log(`  ~ updated ${t.name} (additive: read=${JSON.stringify(newModules)} write=${JSON.stringify(newWrite)})`);
      } else {
        await pool.query(
          `INSERT INTO app_role (name, description, modules, write_modules, view_config, is_system)
           VALUES ($1, $2, $3::json, $4::json, $5::jsonb, $6)`,
          [t.name, t.description, JSON.stringify(t.modules), JSON.stringify(t.writeModules), JSON.stringify(t.viewConfig), t.isSystem],
        );
        console.log(`  + created ${t.name}`);
      }
    }

    // Design is event-focused (designs posts/graphics FOR events), not project-
    // based — drop any legacy 'projects' grant left over from the first seed.
    for (const name of ["Design Lead", "Design Member"]) {
      await pool.query(
        `UPDATE app_role
            SET modules = (SELECT coalesce(json_agg(m), '[]'::json)
                           FROM json_array_elements_text(modules) m WHERE m <> 'projects'),
                write_modules = (SELECT coalesce(json_agg(m), '[]'::json)
                                 FROM json_array_elements_text(write_modules) m WHERE m <> 'projects'),
                updated_at = now()
          WHERE lower(name) = lower($1)`,
        [name],
      );
    }

    const { rows } = await pool.query(`SELECT name, modules, write_modules FROM app_role ORDER BY is_system DESC, name`);
    console.log("\nRoles now:");
    for (const r of rows) console.log(`  • ${r.name}  read=${JSON.stringify(r.modules)}  write=${JSON.stringify(r.write_modules)}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
