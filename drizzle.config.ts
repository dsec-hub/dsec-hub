import { config } from "dotenv";
config({ path: ".env.local" });

import { defineConfig } from "drizzle-kit";

// dsec-api owns the schema (Alembic migrations). dsec-app only introspects the
// live Neon tables with `drizzle-kit pull` and reads/writes them — it never
// generates or runs migrations here.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./src/db",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
