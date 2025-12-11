import "server-only";

import postgres from "postgres";

/**
 * Database client for Neon Postgres
 * Automatically uses connection string from environment variables
 * Using postgres.js for better compatibility
 */

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.warn("[db] DATABASE_URL not configured. Database operations will fail.");
}

// Create Postgres client using postgres.js
// Works perfectly with Neon and supports standard $1, $2 parameters
export const sql = DATABASE_URL ? postgres(DATABASE_URL, {
  // Disable prepared statements for Neon pooler compatibility
  prepare: false,
}) : null;

/**
 * Execute a database query
 * Falls back gracefully if database is not configured
 * 
 * Using postgres.js which fully supports $1, $2 style parameters
 */
export async function query<T = unknown>(
  sqlQuery: string,
  params: unknown[] = []
): Promise<T[]> {
  if (!sql) {
    console.error("[db] Database not configured");
    return [];
  }

  try {
    // postgres.js supports both tagged templates and unsafe() for raw queries
    const result = await sql.unsafe(sqlQuery, params as never[]);
    return (result as unknown) as T[];
  } catch (error) {
    console.error("[db] Query error:", error);
    throw error;
  }
}

/**
 * Check if database is available and configured
 */
export function isDatabaseAvailable(): boolean {
  return Boolean(sql);
}

