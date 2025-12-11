import "server-only";

import { query, isDatabaseAvailable } from "@/lib/db";

/**
 * Storage abstraction that uses Neon Postgres
 * Provides a simple key-value interface backed by a relational database
 * 
 * Note: This is a legacy compatibility layer. New code should use direct database queries.
 */

export interface StorageRecord {
  key: string;
  value: string;
  updated_at: string;
}

/**
 * Initialize storage table if it doesn't exist
 */
async function ensureStorageTable() {
  if (!isDatabaseAvailable()) return false;

  try {
    await query(`
      CREATE TABLE IF NOT EXISTS key_value_storage (
        key VARCHAR(255) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    return true;
  } catch (error) {
    console.error("[storage] Failed to create storage table:", error);
    return false;
  }
}

// Initialize storage table on module load
ensureStorageTable().catch(() => {
  // Silently fail if database is not configured
});

/**
 * Unified storage interface
 */
export const storage = {
  /**
   * Read data from storage
   */
  async read<T>(key: string): Promise<T | null> {
    if (!isDatabaseAvailable()) {
      console.warn("[storage] Database not available for read:", key);
      return null;
    }

    try {
      const result = await query<StorageRecord>(
        "SELECT value FROM key_value_storage WHERE key = $1",
        [key]
      );

      if (result.length === 0) return null;

      const parsed = JSON.parse(result[0].value) as T;
      return parsed;
    } catch (error) {
      console.error("[storage] Read error:", error);
      return null;
    }
  },

  /**
   * Write data to storage
   */
  async write<T>(key: string, data: T): Promise<boolean> {
    if (!isDatabaseAvailable()) {
      console.warn("[storage] Database not available for write:", key);
      return false;
    }

    try {
      const serialized = JSON.stringify(data);
      
      await query(
        `INSERT INTO key_value_storage (key, value, updated_at) 
         VALUES ($1, $2, NOW())
         ON CONFLICT (key) 
         DO UPDATE SET value = $2, updated_at = NOW()`,
        [key, serialized]
      );

      return true;
    } catch (error) {
      console.error("[storage] Write error:", error);
      return false;
    }
  },

  /**
   * Delete data from storage
   */
  async delete(key: string): Promise<boolean> {
    if (!isDatabaseAvailable()) {
      console.warn("[storage] Database not available for delete:", key);
      return false;
    }

    try {
      await query("DELETE FROM key_value_storage WHERE key = $1", [key]);
      return true;
    } catch (error) {
      console.error("[storage] Delete error:", error);
      return false;
    }
  },

  /**
   * Check which storage backend is being used
   */
  getBackend(): "postgres" | "unavailable" {
    return isDatabaseAvailable() ? "postgres" : "unavailable";
  },
};
