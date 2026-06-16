/**
 * One-time (idempotent) migration: create the app-owned `committee` table and
 * seed it with the club's existing committees.
 *
 *   npx tsx scripts/create-committee-table.ts
 *
 * Committees used to be a hardcoded constant (`COMMITTEES` in src/lib/options.ts);
 * this table makes them editable from Admin → Committees (name, colour,
 * description, lead, active). Records elsewhere still store the committee *name*
 * as a string — renames cascade to them from the admin action.
 *
 * The DDL is additive and guarded with `IF NOT EXISTS`, and the seed only runs
 * when the table is empty, so this script is safe to re-run.
 *
 * NOTE: dsec-api owns the core schema via Alembic; these app-owned tables are
 * created here by hand (never via `alembic --autogenerate`, which can emit
 * destructive DROPs against the live Neon database).
 */
import { config } from "dotenv";

config({ path: ".env.local" });

const DDL = `
CREATE TABLE IF NOT EXISTS committee (
  id              serial PRIMARY KEY,
  name            varchar(128) NOT NULL,
  color           varchar(16),
  description     text,
  lead_person_id  integer REFERENCES people(id) ON DELETE SET NULL,
  is_active       boolean NOT NULL DEFAULT true,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ix_committee_name ON committee (lower(name));
CREATE INDEX IF NOT EXISTS ix_committee_is_active ON committee (is_active);
CREATE INDEX IF NOT EXISTS ix_committee_sort_order ON committee (sort_order);
`;

// Mirrors the old COMMITTEES constant, with a distinct on-brand colour each.
const SEED: { name: string; color: string }[] = [
  { name: "Executive", color: "#e91e63" },
  { name: "Events", color: "#f59e0b" },
  { name: "Marketing", color: "#8b5cf6" },
  { name: "Sponsorship", color: "#10b981" },
  { name: "Technical", color: "#3b82f6" },
  { name: "Operations", color: "#64748b" },
];

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
    console.log("Creating committee table + indexes (idempotent)…");
    await pool.query(DDL);

    const { rows: countRows } = await pool.query<{ n: string }>(
      "SELECT count(*)::int AS n FROM committee",
    );
    const existing = Number(countRows[0]?.n ?? 0);

    if (existing === 0) {
      console.log(`Seeding ${SEED.length} default committees…`);
      for (let i = 0; i < SEED.length; i++) {
        const { name, color } = SEED[i];
        await pool.query(
          `INSERT INTO committee (name, color, sort_order) VALUES ($1, $2, $3)`,
          [name, color, i],
        );
      }
    } else {
      console.log(`Table already has ${existing} committee(s) — skipping seed.`);
    }

    const { rows } = await pool.query(
      `SELECT id, name, color, is_active, sort_order FROM committee ORDER BY sort_order, name`,
    );
    console.log("Done. Committees:");
    for (const r of rows) {
      console.log(
        `  • ${r.name} (${r.color ?? "no colour"})${r.is_active ? "" : " · inactive"}`,
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
