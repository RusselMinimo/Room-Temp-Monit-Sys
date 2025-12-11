import "server-only";

import { query, isDatabaseAvailable } from "@/lib/db";
import { publishReading } from "@/lib/bus";
import { handleReadingForAlerts } from "@/lib/alerts";

export interface Reading {
  deviceId: string;
  ts: string; // ISO string
  temperatureC: number;
  humidityPct?: number;
  rssi?: number;
  isDemo?: boolean;
}

interface ReadingRow {
  id: number;
  device_id: string;
  temperature_c: string;
  humidity_pct: string | null;
  rssi: number | null;
  is_demo: boolean;
  ts: string;
}

const DEFAULT_READING_TTL_MS = 60_000;
const MAX_HISTORY_PER_DEVICE = 500;

// In-memory cache for backwards compatibility and performance
// This cache is used when database is not available
const deviceIdToReadings: Map<string, Reading[]> = new Map();

function rowToReading(row: ReadingRow): Reading {
  return {
    deviceId: row.device_id,
    ts: new Date(row.ts).toISOString(),
    temperatureC: parseFloat(row.temperature_c),
    humidityPct: row.humidity_pct !== null ? parseFloat(row.humidity_pct) : undefined,
    rssi: row.rssi ?? undefined,
    isDemo: row.is_demo ?? false,
  };
}

/**
 * Add a new reading to the database
 */
export async function addReading(reading: Reading) {
  // Publish to event bus first (for real-time updates)
  publishReading(reading);
  handleReadingForAlerts(reading);

  if (!isDatabaseAvailable()) {
    // Fallback to in-memory storage
    console.warn("[store] Database not available, using in-memory storage");
    const list = deviceIdToReadings.get(reading.deviceId) ?? [];
    list.push(reading);
    if (list.length > MAX_HISTORY_PER_DEVICE) list.shift();
    deviceIdToReadings.set(reading.deviceId, list);
    return;
  }

  try {
    await query(
      `INSERT INTO readings (device_id, temperature_c, humidity_pct, rssi, is_demo, ts)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        reading.deviceId,
        reading.temperatureC,
        reading.humidityPct ?? null,
        reading.rssi ?? null,
        reading.isDemo ?? false,
        reading.ts,
      ]
    );

    // Cleanup old readings to maintain MAX_HISTORY_PER_DEVICE limit
    await query(
      `DELETE FROM readings 
       WHERE device_id = $1 
       AND id NOT IN (
         SELECT id FROM readings 
         WHERE device_id = $1 
         ORDER BY ts DESC 
         LIMIT $2
       )`,
      [reading.deviceId, MAX_HISTORY_PER_DEVICE]
    );
  } catch (error) {
    console.error("[store] Failed to add reading:", error);
    // Fallback to in-memory storage on error
    const list = deviceIdToReadings.get(reading.deviceId) ?? [];
    list.push(reading);
    if (list.length > MAX_HISTORY_PER_DEVICE) list.shift();
    deviceIdToReadings.set(reading.deviceId, list);
  }
}

/**
 * Get the latest reading for a specific device
 */
export async function getLatestReading(deviceId: string): Promise<Reading | null> {
  if (!isDatabaseAvailable()) {
    // Fallback to in-memory storage
    const list = deviceIdToReadings.get(deviceId);
    if (!list || list.length === 0) return null;
    return list[list.length - 1];
  }

  try {
    const result = await query<ReadingRow>(
      `SELECT * FROM readings 
       WHERE device_id = $1 
       ORDER BY ts DESC 
       LIMIT 1`,
      [deviceId]
    );

    if (result.length === 0) return null;
    return rowToReading(result[0]);
  } catch (error) {
    console.error("[store] Failed to get latest reading:", error);
    return null;
  }
}

/**
 * List all unique device IDs
 */
export async function listDevices(): Promise<string[]> {
  if (!isDatabaseAvailable()) {
    // Fallback to in-memory storage
    return Array.from(deviceIdToReadings.keys()).sort();
  }

  try {
    const result = await query<{ device_id: string }>(
      `SELECT DISTINCT device_id FROM readings ORDER BY device_id`
    );

    return result.map((row) => row.device_id);
  } catch (error) {
    console.error("[store] Failed to list devices:", error);
    return [];
  }
}

/**
 * List latest readings for all devices
 */
export function listLatestReadings(ttlMs: number = DEFAULT_READING_TTL_MS): Reading[] {
  if (!isDatabaseAvailable()) {
    // Fallback to in-memory storage
    const cutoff = Date.now() - ttlMs;
    const readings: Reading[] = [];
    for (const list of deviceIdToReadings.values()) {
      const latest = list[list.length - 1];
      if (!latest) continue;
      
      const tsValue = Date.parse(latest.ts);
      if (Number.isFinite(tsValue) && tsValue >= cutoff) {
        readings.push(latest);
      } else if (list.length > 0) {
        // Include stale reading so offline devices remain visible
        readings.push(latest);
      }
    }
    return readings;
  }

  // For database mode, we fetch synchronously from a cache
  // This is called from API routes that need sync access
  // In the future, we should refactor API routes to be async
  return listLatestReadingsSync(ttlMs);
}

// Internal cache for sync access
let latestReadingsCache: Reading[] = [];
let lastCacheUpdate = 0;
const CACHE_TTL_MS = 1000; // 1 second cache

/**
 * Synchronous version that uses a cache
 * Used for backwards compatibility with existing API routes
 */
function listLatestReadingsSync(ttlMs: number = DEFAULT_READING_TTL_MS): Reading[] {
  const now = Date.now();
  
  // Return cached data if fresh
  if (now - lastCacheUpdate < CACHE_TTL_MS) {
    return latestReadingsCache;
  }

  // Update cache asynchronously (non-blocking)
  updateLatestReadingsCache(ttlMs).catch((error) => {
    console.error("[store] Failed to update cache:", error);
  });

  return latestReadingsCache;
}

/**
 * Update the latest readings cache from database
 */
async function updateLatestReadingsCache(ttlMs: number = DEFAULT_READING_TTL_MS) {
  if (!isDatabaseAvailable()) return;

  try {
    const cutoffDate = new Date(Date.now() - ttlMs).toISOString();
    
    const result = await query<ReadingRow>(
      `SELECT DISTINCT ON (device_id) *
       FROM readings
       WHERE ts >= $1 OR id IN (
         SELECT MAX(id) FROM readings GROUP BY device_id
       )
       ORDER BY device_id, ts DESC`,
      [cutoffDate]
    );

    latestReadingsCache = result.map(rowToReading);
    lastCacheUpdate = Date.now();
  } catch (error) {
    console.error("[store] Failed to fetch latest readings:", error);
  }
}

/**
 * Get count of active devices (within TTL)
 */
export function getActiveDeviceCount(ttlMs: number = DEFAULT_READING_TTL_MS): number {
  const readings = listLatestReadings(ttlMs);
  const cutoff = Date.now() - ttlMs;
  
  let activeCount = 0;
  for (const reading of readings) {
    const tsValue = Date.parse(reading.ts);
    if (Number.isFinite(tsValue) && tsValue >= cutoff && reading.isDemo !== true) {
      activeCount++;
    }
  }
  
  return activeCount;
}

/**
 * Get total count of all devices (including offline)
 */
export function getTotalDeviceCount(): number {
  const readings = listLatestReadings(Number.MAX_SAFE_INTEGER);
  
  let totalCount = 0;
  for (const reading of readings) {
    if (reading.isDemo !== true) {
      totalCount++;
    }
  }
  
  return totalCount;
}

/**
 * Get historical readings for a device
 */
export async function getDeviceHistory(
  deviceId: string,
  limit: number = 100
): Promise<Reading[]> {
  if (!isDatabaseAvailable()) {
    // Fallback to in-memory storage
    const list = deviceIdToReadings.get(deviceId) ?? [];
    return list.slice(-limit);
  }

  try {
    const result = await query<ReadingRow>(
      `SELECT * FROM readings 
       WHERE device_id = $1 
       ORDER BY ts DESC 
       LIMIT $2`,
      [deviceId, limit]
    );

    return result.map(rowToReading).reverse();
  } catch (error) {
    console.error("[store] Failed to get device history:", error);
    return [];
  }
}

/**
 * Delete old readings (cleanup job)
 */
export async function cleanupOldReadings(daysToKeep: number = 30): Promise<number> {
  if (!isDatabaseAvailable()) {
    console.warn("[store] Database not available for cleanup");
    return 0;
  }

  try {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).toISOString();
    
    const result = await query<{ count: string }>(
      `WITH deleted AS (
         DELETE FROM readings 
         WHERE ts < $1 
         RETURNING id
       )
       SELECT COUNT(*) as count FROM deleted`,
      [cutoffDate]
    );

    const count = parseInt(result[0]?.count ?? "0", 10);
    console.log(`[store] Cleaned up ${count} old readings`);
    return count;
  } catch (error) {
    console.error("[store] Failed to cleanup old readings:", error);
    return 0;
  }
}

// Initialize cache on module load
if (isDatabaseAvailable()) {
  updateLatestReadingsCache().catch(() => {
    // Silently fail on initial load
  });
}
