export interface Reading {
  deviceId: string;
  ts: string; // ISO string
  temperatureC: number;
  humidityPct?: number;
  rssi?: number;
  isDemo?: boolean;
}

const deviceIdToReadings: Map<string, Reading[]> = new Map();
const DEFAULT_READING_TTL_MS = 60_000;
const MAX_HISTORY_PER_DEVICE = 500;

import { publishReading } from "@/lib/bus";
import { handleReadingForAlerts } from "@/lib/alerts";

function pruneStaleReadings(ttlMs: number = DEFAULT_READING_TTL_MS) {
  if (ttlMs <= 0) return;
  const cutoff = Date.now() - ttlMs;
  for (const [deviceId, readings] of deviceIdToReadings.entries()) {
    if (readings.length === 0) {
      deviceIdToReadings.delete(deviceId);
      continue;
    }

    const fresh = readings.filter((reading) => {
      const tsValue = Date.parse(reading.ts);
      if (!Number.isFinite(tsValue)) return false;
      return tsValue >= cutoff;
    });

    if (fresh.length === 0) {
      const latest = readings[readings.length - 1];
      if (latest) {
        // Preserve the latest reading so offline devices remain visible to admins.
        deviceIdToReadings.set(deviceId, [latest]);
      } else {
        deviceIdToReadings.delete(deviceId);
      }
      continue;
    }

    if (fresh.length !== readings.length) {
      deviceIdToReadings.set(deviceId, fresh);
    }
  }
}

export function addReading(reading: Reading) {
  pruneStaleReadings();
  const list = deviceIdToReadings.get(reading.deviceId) ?? [];
  list.push(reading);
  if (list.length > MAX_HISTORY_PER_DEVICE) list.shift();
  deviceIdToReadings.set(reading.deviceId, list);
  publishReading(reading);
  handleReadingForAlerts(reading);
}

export function getLatestReading(deviceId: string): Reading | null {
  pruneStaleReadings();
  const list = deviceIdToReadings.get(deviceId);
  if (!list || list.length === 0) return null;
  return list[list.length - 1];
}

export function listDevices(): string[] {
  pruneStaleReadings();
  return Array.from(deviceIdToReadings.keys()).sort();
}

export function listLatestReadings(ttlMs: number = DEFAULT_READING_TTL_MS): Reading[] {
  pruneStaleReadings(ttlMs);
  const readings: Reading[] = [];
  for (const list of deviceIdToReadings.values()) {
    const latest = list[list.length - 1];
    if (latest) readings.push(latest);
  }
  return readings;
}

export function getActiveDeviceCount(ttlMs: number = DEFAULT_READING_TTL_MS): number {
  pruneStaleReadings(ttlMs);
  const cutoff = Date.now() - ttlMs;
  let activeCount = 0;
  
  for (const [deviceId, readings] of deviceIdToReadings.entries()) {
    if (readings.length === 0) continue;
    
    const latest = readings[readings.length - 1];
    if (!latest) continue;
    
    // Count as active if latest reading is within TTL and not demo
    const tsValue = Date.parse(latest.ts);
    if (Number.isFinite(tsValue) && tsValue >= cutoff && latest.isDemo !== true) {
      activeCount++;
    }
  }
  
  return activeCount;
}

export function getTotalDeviceCount(): number {
  pruneStaleReadings();
  let totalCount = 0;
  
  for (const [deviceId, readings] of deviceIdToReadings.entries()) {
    if (readings.length === 0) continue;
    
    const latest = readings[readings.length - 1];
    if (latest && latest.isDemo !== true) {
      totalCount++;
    }
  }
  
  return totalCount;
}
