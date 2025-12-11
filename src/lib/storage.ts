import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Storage abstraction that supports both file system (local/dev) and Vercel KV (production)
 * Automatically detects which storage backend to use based on environment
 */

const DATA_DIR = join(process.cwd(), "data");
const USE_KV = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

// Dynamically import KV only if available
let kv: { get: <T>(key: string) => Promise<T | null>; set: (key: string, value: unknown) => Promise<void>; del: (key: string) => Promise<void> } | null = null;
if (USE_KV) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const kvModule = require("@vercel/kv");
    kv = kvModule.kv;
  } catch {
    // KV not available, will fall back to file system
  }
}

/**
 * Check if Vercel KV is available and configured
 */
function isKVAvailable(): boolean {
  return USE_KV;
}

/**
 * File-based storage operations
 */
const fileStorage = {
  read<T>(key: string): T | null {
    const filePath = join(DATA_DIR, `${key}.json`);
    if (!existsSync(filePath)) return null;
    try {
      const raw = readFileSync(filePath, "utf8");
      if (!raw.trim()) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },

  write<T>(key: string, data: T): boolean {
    try {
      if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
      const filePath = join(DATA_DIR, `${key}.json`);
      const serialized = JSON.stringify(data, null, 2);
      writeFileSync(filePath, serialized, "utf8");
      return true;
    } catch {
      return false;
    }
  },

  delete(key: string): boolean {
    try {
      const filePath = join(DATA_DIR, `${key}.json`);
      if (existsSync(filePath)) {
        writeFileSync(filePath, "", "utf8");
      }
      return true;
    } catch {
      return false;
    }
  },
};

/**
 * Vercel KV storage operations
 */
const kvStorage = {
  async read<T>(key: string): Promise<T | null> {
    if (!isKVAvailable() || !kv) return null;
    try {
      const data = await kv.get<T>(key);
      return data ?? null;
    } catch {
      return null;
    }
  },

  async write<T>(key: string, data: T): Promise<boolean> {
    if (!isKVAvailable() || !kv) return false;
    try {
      await kv.set(key, data);
      return true;
    } catch {
      return false;
    }
  },

  async delete(key: string): Promise<boolean> {
    if (!isKVAvailable() || !kv) return false;
    try {
      await kv.del(key);
      return true;
    } catch {
      return false;
    }
  },
};

/**
 * Unified storage interface
 * Automatically uses KV if available, otherwise falls back to file system
 */
export const storage = {
  /**
   * Read data from storage
   */
  async read<T>(key: string): Promise<T | null> {
    if (isKVAvailable()) {
      return await kvStorage.read<T>(key);
    }
    return fileStorage.read<T>(key);
  },

  /**
   * Write data to storage
   */
  async write<T>(key: string, data: T): Promise<boolean> {
    if (isKVAvailable()) {
      return await kvStorage.write(key, data);
    }
    return fileStorage.write(key, data);
  },

  /**
   * Delete data from storage
   */
  async delete(key: string): Promise<boolean> {
    if (isKVAvailable()) {
      return await kvStorage.delete(key);
    }
    return fileStorage.delete(key);
  },

  /**
   * Check which storage backend is being used
   */
  getBackend(): "kv" | "filesystem" {
    return isKVAvailable() ? "kv" : "filesystem";
  },
};

