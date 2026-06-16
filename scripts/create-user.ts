/**
 * Create (or update) a dsec-app login.
 *
 *   npx tsx scripts/create-user.ts <email> <password> [name]
 *
 * Hashes the password with bcrypt and upserts into the `app_user` table.
 * dotenv is loaded first, and the db module is imported dynamically afterward,
 * so DATABASE_URL is set before the connection pool is created.
 */
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const [email, password, name] = process.argv.slice(2);
  if (!email || !password) {
    console.error("Usage: npx tsx scripts/create-user.ts <email> <password> [name]");
    process.exit(1);
  }

  const bcrypt = (await import("bcryptjs")).default;
  const { eq } = await import("drizzle-orm");
  const { db } = await import("../src/db");
  const { appUser, appRole } = await import("../src/db/schema");
  const { sql } = await import("drizzle-orm");

  const normalizedEmail = email.toLowerCase().trim();
  const passwordHash = await bcrypt.hash(password, 10);

  // Bootstrap users are admins. Falls back gracefully if setup-roles.ts hasn't
  // been run yet (role_id stays null; role string still set).
  const [adminRole] = await db
    .select({ id: appRole.id })
    .from(appRole)
    .where(sql`lower(${appRole.name}) = 'admin'`)
    .limit(1);

  const [existing] = await db
    .select()
    .from(appUser)
    .where(eq(appUser.email, normalizedEmail))
    .limit(1);

  // Bootstrap admins skip the first-run onboarding wizard.
  const now = new Date().toISOString();

  if (existing) {
    await db
      .update(appUser)
      .set({
        passwordHash,
        name: name ?? existing.name,
        isActive: true,
        role: "Admin",
        ...(existing.onboardingCompletedAt ? {} : { onboardingCompletedAt: now }),
        ...(adminRole ? { roleId: adminRole.id } : {}),
      })
      .where(eq(appUser.id, existing.id));
    console.log(`Updated user: ${normalizedEmail}`);
  } else {
    await db.insert(appUser).values({
      email: normalizedEmail,
      name: name ?? null,
      passwordHash,
      role: "Admin",
      roleId: adminRole?.id ?? null,
      isActive: true,
      onboardingCompletedAt: now,
    });
    console.log(`Created user: ${normalizedEmail}`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
