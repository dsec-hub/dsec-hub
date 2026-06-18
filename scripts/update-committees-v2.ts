/**
 * Idempotent committee catalog migration (Tasks-Views + Roles initiative):
 *
 *   • RENAME the "Sponsorship" committee -> "External Affairs" (now owns
 *     sponsorships AND outreach to other clubs / partnerships), cascading the
 *     denormalised committee-name string in people / events / task / task_board.
 *   • ADD a "Design" committee (graphics/posts), seeded INACTIVE — it's an
 *     empty role with no members yet; activate from Admin → Committees when
 *     staffed. (Marketing is left untouched — Marketing & Design are distinct.)
 *
 *   npx tsx scripts/update-committees-v2.ts
 *
 * Runs in a SINGLE transaction with pre/post count assertions so a partial
 * rename can never leave mixed strings. Safe to re-run (no-op once applied).
 *
 * App-owned (committee table) — applied by hand, never via alembic autogenerate.
 */
import { config } from "dotenv";

config({ path: ".env.local" });

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
    const countSponsorship = async () => {
      const q = async (t: string, col = "committee") =>
        (await client.query(`SELECT count(*)::int AS n FROM ${t} WHERE lower(${col}) = 'sponsorship'`)).rows[0].n as number;
      return {
        committee: (await client.query(`SELECT count(*)::int AS n FROM committee WHERE lower(name) = 'sponsorship'`)).rows[0].n as number,
        people: await q("people"),
        events: await q("events"),
        task: await q("task"),
        task_board: await q("task_board"),
      };
    };
    const countExternal = async () => {
      const q = async (t: string, col = "committee") =>
        (await client.query(`SELECT count(*)::int AS n FROM ${t} WHERE lower(${col}) = 'external affairs'`)).rows[0].n as number;
      return {
        committee: (await client.query(`SELECT count(*)::int AS n FROM committee WHERE lower(name) = 'external affairs'`)).rows[0].n as number,
        people: await q("people"),
        events: await q("events"),
        task: await q("task"),
        task_board: await q("task_board"),
      };
    };

    await client.query("BEGIN");

    const pre = await countSponsorship();
    const preExt = await countExternal();
    console.log("Pre-migration 'Sponsorship' counts:", pre);

    await client.query(`UPDATE committee  SET name = 'External Affairs', updated_at = now() WHERE lower(name) = 'sponsorship'`);
    await client.query(`UPDATE people      SET committee = 'External Affairs' WHERE lower(committee) = 'sponsorship'`);
    await client.query(`UPDATE events      SET committee = 'External Affairs' WHERE lower(committee) = 'sponsorship'`);
    await client.query(`UPDATE task        SET committee = 'External Affairs' WHERE lower(committee) = 'sponsorship'`);
    await client.query(`UPDATE task_board  SET committee = 'External Affairs' WHERE lower(committee) = 'sponsorship'`);

    const post = await countExternal();
    console.log("Post-migration 'External Affairs' counts:", post);

    // Every Sponsorship row must now be an External Affairs row (accounting for
    // any that were already External Affairs from a prior run).
    const keys = ["committee", "people", "events", "task", "task_board"] as const;
    for (const k of keys) {
      const expected = pre[k] + preExt[k];
      if (post[k] !== expected) {
        throw new Error(`Cascade mismatch on ${k}: expected ${expected} External Affairs rows, found ${post[k]}. Rolling back.`);
      }
    }

    // Add Design committee (inactive) if absent.
    const ins = await client.query(
      `INSERT INTO committee (name, color, is_active, sort_order)
       SELECT 'Design', '#ec4899', false, 6
       WHERE NOT EXISTS (SELECT 1 FROM committee WHERE lower(name) = 'design')
       RETURNING id`,
    );
    console.log(ins.rowCount ? "Added 'Design' committee (inactive)." : "'Design' committee already exists — skipped.");

    await client.query("COMMIT");

    const { rows } = await client.query(
      `SELECT name, is_active, sort_order FROM committee ORDER BY sort_order, lower(name)`,
    );
    console.log("Committees now:");
    for (const r of rows) console.log(`  • ${r.name}${r.is_active ? "" : " (inactive)"}  [sort ${r.sort_order}]`);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
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
