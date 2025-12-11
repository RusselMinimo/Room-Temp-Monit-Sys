// Standalone script - do not use "server-only" as this is run with tsx, not Next.js
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "@/lib/db";

/**
 * Run database migrations
 * Execute this file to initialize or update the database schema
 */

async function runMigration(name: string, sqlContent: string) {
  if (!sql) {
    throw new Error("Database not configured. Set DATABASE_URL environment variable.");
  }

  console.log(`[migrate] Running migration: ${name}`);
  
  try {
    await sql.unsafe(sqlContent);
    console.log(`[migrate] ✓ Completed: ${name}`);
  } catch (error) {
    console.error(`[migrate] ✗ Failed: ${name}`, error);
    throw error;
  }
}

export async function runMigrations() {
  console.log("[migrate] Starting database migrations...");

  // Migration 001: Initial schema
  const migration001 = readFileSync(
    join(process.cwd(), "src/lib/migrations/001_initial_schema.sql"),
    "utf-8"
  );
  await runMigration("001_initial_schema", migration001);

  console.log("[migrate] All migrations completed successfully!");
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log("[migrate] Done!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("[migrate] Fatal error:", error);
      process.exit(1);
    });
}

