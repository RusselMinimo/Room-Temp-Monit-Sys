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

function pruneStaleReadings(ttlMs: number = DEFAULT_READING_TTL_MS) {
  if (ttlMs <= 0) return;
  const cutoff = Date.now() - ttlMs;
  for (const [deviceId, readings] of deviceIdToReadings.entries()) {
    const fresh = readings.filter((reading) => {
      const tsValue = Date.parse(reading.ts);
      if (!Number.isFinite(tsValue)) return false;
      return tsValue >= cutoff;
    });
    if (fresh.length === 0) {
      deviceIdToReadings.delete(deviceId);
    } else if (fresh.length !== readings.length) {
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
