/**
 * One-time (idempotent) setup for the dsec-app role system.
 *
 *   npx tsx scripts/setup-roles.ts
 *
 * Creates the `app_role` and `app_invite` tables and the `app_user.role_id`
 * column, seeds the built-in roles, and backfills every existing user to the
 * Admin role so current execs keep full access. Safe to re-run.
 *
 * NOTE: dsec-api owns the core schema via Alembic. These RBAC tables are
 * app-owned and intentionally created here rather than in an Alembic migration.
 */
import { config } from "dotenv";

config({ path: ".env.local" });

// Module keys must mirror src/lib/rbac.ts. Keep this list in sync when new
// modules are added there, or non-admin roles can never be granted them.
const APP_MODULES = [
  "events",
  "people",
  "sponsors",
  "finance",
  "tasks",
  "projects",
  "members",
  "meetings",
  "documents",
];
const ALL_MODULES = [...APP_MODULES, "admin"];

// `modules` = sections a role can SEE; `writeModules` = the subset it can also
// EDIT (write ⊆ read). "admin" is a superuser for both.
const PRESET_ROLES: {
  name: string;
  description: string;
  modules: string[];
  writeModules: string[];
  isSystem: boolean;
}[] = [
  { name: "Admin", description: "Full access to every module plus user, role, and invite management.", modules: ALL_MODULES, writeModules: ALL_MODULES, isSystem: true },
  { name: "Exec", description: "Full access to every operational module (no admin panel).", modules: APP_MODULES, writeModules: APP_MODULES, isSystem: false },
  { name: "Events Lead", description: "Edit events; view people.", modules: ["events", "people"], writeModules: ["events"], isSystem: false },
  { name: "Sponsorship", description: "Edit sponsors; view people.", modules: ["sponsors", "people"], writeModules: ["sponsors"], isSystem: false },
  { name: "Treasurer", description: "Finance only.", modules: ["finance"], writeModules: ["finance"], isSystem: false },
  { name: "Viewer", description: "Overview dashboard only.", modules: [], writeModules: [], isSystem: false },
  { name: "Auditor", description: "Read-only access to every operational module — sees everything, edits nothing.", modules: APP_MODULES, writeModules: [], isSystem: false },
];

const DDL = `
CREATE TABLE IF NOT EXISTS app_role (
  id            serial PRIMARY KEY,
  name          varchar(64) NOT NULL,
  description   varchar(256),
  modules       json NOT NULL DEFAULT '[]',
  write_modules json NOT NULL DEFAULT '[]',
  is_system     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ix_app_role_name ON app_role (lower(name));

-- write_modules was added after the initial release. Add it to pre-existing
-- tables and backfill ONCE (write = read) so current roles keep full write
-- access; admins then dial sections back to view-only in the role editor.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_role' AND column_name = 'write_modules'
  ) THEN
    ALTER TABLE app_role ADD COLUMN write_modules json NOT NULL DEFAULT '[]';
    UPDATE app_role SET write_modules = modules;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS app_invite (
  id          serial PRIMARY KEY,
  email       varchar(256) NOT NULL,
  role_id     integer NOT NULL REFERENCES app_role(id),
  token_hash  varchar(128) NOT NULL,
  status      varchar(16) NOT NULL DEFAULT 'pending',
  invited_by  varchar(256),
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  accepted_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS ix_app_invite_token_hash ON app_invite (token_hash);
CREATE INDEX IF NOT EXISTS ix_app_invite_email ON app_invite (lower(email));
CREATE INDEX IF NOT EXISTS ix_app_invite_status ON app_invite (status);

ALTER TABLE app_user ADD COLUMN IF NOT EXISTS role_id integer;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'app_user_role_id_fkey'
  ) THEN
    ALTER TABLE app_user ADD CONSTRAINT app_user_role_id_fkey
      FOREIGN KEY (role_id) REFERENCES app_role(id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS ix_app_user_role_id ON app_user (role_id);
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
    console.log("Creating RBAC tables / columns…");
    await pool.query(DDL);

    console.log("Seeding built-in roles…");
    for (const r of PRESET_ROLES) {
      await pool.query(
        `INSERT INTO app_role (name, description, modules, write_modules, is_system)
         SELECT $1::text, $2::text, $3::json, $4::json, $5::boolean
         WHERE NOT EXISTS (SELECT 1 FROM app_role WHERE lower(name) = lower($1::text))`,
        [r.name, r.description, JSON.stringify(r.modules), JSON.stringify(r.writeModules), r.isSystem],
      );
    }

    // Backfill the full module set onto the built-in Admin and Exec roles so
    // existing installs pick up newly-added modules (the INSERT above only
    // creates missing roles — it never updates an existing one). Scoped roles
    // like "Treasurer" are intentionally left as-is.
    console.log("Refreshing Admin / Exec module access…");
    await pool.query(
      `UPDATE app_role SET modules = $1::json, write_modules = $1::json, updated_at = now() WHERE lower(name) = 'admin'`,
      [JSON.stringify(ALL_MODULES)],
    );
    await pool.query(
      `UPDATE app_role SET modules = $1::json, write_modules = $1::json, updated_at = now() WHERE lower(name) = 'exec'`,
      [JSON.stringify(APP_MODULES)],
    );

    const { rows: adminRows } = await pool.query(
      `SELECT id FROM app_role WHERE lower(name) = 'admin' LIMIT 1`,
    );
    const adminId = adminRows[0]?.id;

    if (adminId) {
      const { rowCount } = await pool.query(
        `UPDATE app_user SET role_id = $1, role = 'Admin' WHERE role_id IS NULL`,
        [adminId],
      );
      console.log(`Backfilled ${rowCount ?? 0} existing user(s) to the Admin role.`);
    }

    console.log("Done. Roles available:");
    const { rows } = await pool.query(
      `SELECT name, modules, write_modules, is_system FROM app_role ORDER BY is_system DESC, name`,
    );
    for (const row of rows) {
      console.log(
        `  • ${row.name}${row.is_system ? " (system)" : ""} → read ${JSON.stringify(row.modules)} · write ${JSON.stringify(row.write_modules)}`,
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
