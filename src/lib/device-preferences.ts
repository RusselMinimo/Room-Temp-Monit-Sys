import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { DevicePreferences, TemperatureThresholds } from "@/types/devices";

const DATA_DIR = join(process.cwd(), "data");
const PREFERENCES_FILE = join(DATA_DIR, "device-preferences.json");
const LEGACY_LABELS_FILE = join(DATA_DIR, "device-labels.json");

const deviceIdToPreferences = new Map<string, DevicePreferences>();

function loadPreferencesFromDisk() {
  const fileToRead = existsSync(PREFERENCES_FILE)
    ? PREFERENCES_FILE
    : existsSync(LEGACY_LABELS_FILE)
      ? LEGACY_LABELS_FILE
      : undefined;

  if (!fileToRead) return;

  try {
    const raw = readFileSync(fileToRead, "utf8");
    if (!raw.trim()) return;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const [deviceId, value] of Object.entries(parsed)) {
      const normalizedId = deviceId.trim();
      if (!normalizedId) continue;

      if (typeof value === "string") {
        setPreference(normalizedId, { label: normalizeLabel(value) });
        continue;
      }

      if (value && typeof value === "object") {
        const obj = value as {
          label?: unknown;
          thresholds?: unknown;
          thresholdsByUser?: unknown;
          labelsByUser?: unknown;
        };
        const label = normalizeLabel(obj.label);
        const legacy = normalizeThresholds(obj.thresholds);
        const byUser: Record<string, TemperatureThresholds> = {};
        if (obj.thresholdsByUser && typeof obj.thresholdsByUser === "object") {
          for (const [email, t] of Object.entries(obj.thresholdsByUser as Record<string, unknown>)) {
            const normalizedEmail = email.trim().toLowerCase();
            const norm = normalizeThresholds(t);
            if (norm && normalizedEmail) byUser[normalizedEmail] = norm;
          }
        }
        const labelsByUser: Record<string, string> = {};
        if (obj.labelsByUser && typeof obj.labelsByUser === "object") {
          for (const [email, val] of Object.entries(obj.labelsByUser as Record<string, unknown>)) {
            const normalizedEmail = email.trim().toLowerCase();
            const normalized = normalizeLabel(val);
            if (normalized && normalizedEmail) labelsByUser[normalizedEmail] = normalized;
          }
        }
        const pref: DevicePreferences = { label };
        if (Object.keys(byUser).length > 0) pref.thresholdsByUser = byUser;
        if (Object.keys(labelsByUser).length > 0) pref.labelsByUser = labelsByUser;
        // Keep legacy device-level thresholds if present (used as fallback)
        if (legacy) pref.thresholds = legacy;
        setPreference(normalizedId, pref);
      }
    }
  } catch {
    // ignore malformed files
  }
}

function setPreference(deviceId: string, preference: DevicePreferences | undefined) {
  if (!preference || (!preference.label && !preference.thresholds && !preference.thresholdsByUser && !preference.labelsByUser)) {
    deviceIdToPreferences.delete(deviceId);
    return;
  }
  deviceIdToPreferences.set(deviceId, preference);
}

function persistPreferencesToDisk() {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    // Persist raw map content to keep admin-visible structures
    const obj: Record<string, DevicePreferences> = {};
    for (const [deviceId, pref] of deviceIdToPreferences.entries()) {
      const copy: DevicePreferences = { label: pref.label };
      if (pref.thresholds) copy.thresholds = { ...pref.thresholds };
      if (pref.thresholdsByUser) {
        const byUser: Record<string, TemperatureThresholds> = {};
        for (const [email, t] of Object.entries(pref.thresholdsByUser)) {
          const normalizedEmail = email.trim().toLowerCase();
          if (normalizedEmail) byUser[normalizedEmail] = { ...(t ?? {}) };
        }
        copy.thresholdsByUser = byUser;
      }
      if (pref.labelsByUser) {
        const byUser: Record<string, string> = {};
        for (const [email, lbl] of Object.entries(pref.labelsByUser)) {
          const normalizedEmail = email.trim().toLowerCase();
          if (lbl?.trim() && normalizedEmail) byUser[normalizedEmail] = lbl;
        }
        if (Object.keys(byUser).length > 0) copy.labelsByUser = byUser;
      }
      obj[deviceId] = copy;
    }
    const serialized = JSON.stringify(obj, null, 2);
    writeFileSync(PREFERENCES_FILE, serialized, "utf8");
  } catch {
    // swallow file errors on purpose
  }
}

function normalizeLabel(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizeThresholdValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 10) / 10;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.round(parsed * 10) / 10;
    }
  }
  return undefined;
}

function normalizeThresholds(value: unknown): TemperatureThresholds | undefined {
  if (!value || typeof value !== "object") return undefined;
  const input = value as TemperatureThresholds;
  const lowC = normalizeThresholdValue(input.lowC);
  const highC = normalizeThresholdValue(input.highC);

  if (lowC === undefined && highC === undefined) return undefined;
  if (lowC !== undefined && highC !== undefined && lowC > highC) {
    return { lowC: highC, highC: lowC };
  }
  return {
    lowC: lowC ?? undefined,
    highC: highC ?? undefined,
  };
}

function hasOwn(object: object, key: string) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

loadPreferencesFromDisk();

export function listDevicePreferences(): Record<string, DevicePreferences> {
  // Reload from disk to stay in sync across workers
  loadPreferencesFromDisk();
  const result: Record<string, DevicePreferences> = {};
  for (const [deviceId, preference] of deviceIdToPreferences.entries()) {
    const copy: DevicePreferences = { label: preference.label };
    if (preference.thresholds) copy.thresholds = { ...preference.thresholds };
    if (preference.thresholdsByUser) {
      const byUser: Record<string, TemperatureThresholds> = {};
      for (const [email, t] of Object.entries(preference.thresholdsByUser)) {
        const normalizedEmail = email.trim().toLowerCase();
        if (normalizedEmail) byUser[normalizedEmail] = { ...(t ?? {}) };
      }
      copy.thresholdsByUser = byUser;
    }
    if (preference.labelsByUser) {
      const byUser: Record<string, string> = {};
      for (const [email, lbl] of Object.entries(preference.labelsByUser)) {
        const normalizedEmail = email.trim().toLowerCase();
        if (lbl?.trim() && normalizedEmail) byUser[normalizedEmail] = lbl;
      }
      if (Object.keys(byUser).length > 0) copy.labelsByUser = byUser;
    }
    result[deviceId] = copy;
  }
  return result;
}

export function getDevicePreferences(deviceId: string): DevicePreferences | undefined {
  // Reload from disk to stay in sync across workers
  loadPreferencesFromDisk();
  const preference = deviceIdToPreferences.get(deviceId.trim());
  if (!preference) return undefined;
  const copy: DevicePreferences = { label: preference.label };
  if (preference.thresholds) copy.thresholds = { ...preference.thresholds };
  if (preference.thresholdsByUser) {
    const byUser: Record<string, TemperatureThresholds> = {};
    for (const [email, t] of Object.entries(preference.thresholdsByUser)) {
      const normalizedEmail = email.trim().toLowerCase();
      if (normalizedEmail) byUser[normalizedEmail] = { ...(t ?? {}) };
    }
    copy.thresholdsByUser = byUser;
  }
  if (preference.labelsByUser) {
    const byUser: Record<string, string> = {};
    for (const [email, lbl] of Object.entries(preference.labelsByUser)) {
      const normalizedEmail = email.trim().toLowerCase();
      if (lbl?.trim() && normalizedEmail) byUser[normalizedEmail] = lbl;
    }
    if (Object.keys(byUser).length > 0) copy.labelsByUser = byUser;
  }
  return copy;
}

export function updateDevicePreferences(
  deviceId: string,
  updates: { label?: string }
): DevicePreferences | undefined {
  // Reload from disk to stay in sync across workers
  loadPreferencesFromDisk();
  const normalizedId = deviceId.trim();
  if (!normalizedId) return undefined;

  const next: DevicePreferences = { ...(deviceIdToPreferences.get(normalizedId) ?? {}) };
  let changed = false;

  if (hasOwn(updates, "label")) {
    const label = normalizeLabel(updates.label ?? "");
    if (label !== next.label) changed = true;
    if (!label) {
      delete next.label;
    } else {
      next.label = label;
    }
  }

  if (!next.label && !next.thresholds && !next.thresholdsByUser && !next.labelsByUser) {
    if (deviceIdToPreferences.has(normalizedId)) {
      changed = true;
      deviceIdToPreferences.delete(normalizedId);
    }
  } else {
    deviceIdToPreferences.set(normalizedId, next);
  }

  if (changed) persistPreferencesToDisk();

  return getDevicePreferences(normalizedId);
}

export function listDeviceLabels(): Record<string, string> {
  // Reload from disk to stay in sync across workers
  loadPreferencesFromDisk();
  const result: Record<string, string> = {};
  for (const [deviceId, preference] of deviceIdToPreferences.entries()) {
    if (preference.label) result[deviceId] = preference.label;
  }
  return result;
}

export function getDeviceLabel(deviceId: string): string | undefined {
  return deviceIdToPreferences.get(deviceId.trim())?.label;
}

export function setDeviceLabel(deviceId: string, label: string) {
  updateDevicePreferences(deviceId, { label });
}

export function getUserLabel(deviceId: string, email: string): string | undefined {
  // Reload from disk to stay in sync across workers
  loadPreferencesFromDisk();
  const pref = deviceIdToPreferences.get(deviceId.trim());
  if (!pref) return undefined;
  const normalizedEmail = email.trim().toLowerCase();
  const userLabel = pref.labelsByUser?.[normalizedEmail];
  return userLabel ?? pref.label;
}

export function setUserLabel(deviceId: string, email: string, label: string | null | undefined) {
  // Reload from disk to stay in sync across workers
  loadPreferencesFromDisk();
  const normalizedId = deviceId.trim();
  if (!normalizedId) return;
  const normalizedEmail = email.trim().toLowerCase();
  const next: DevicePreferences = { ...(deviceIdToPreferences.get(normalizedId) ?? {}) };
  next.labelsByUser = { ...(next.labelsByUser ?? {}) };
  const normalizedLabel = normalizeLabel(label);
  let changed = false;
  if (!normalizedLabel) {
    if (next.labelsByUser[normalizedEmail]) {
      delete next.labelsByUser[normalizedEmail];
      changed = true;
    }
  } else {
    if (next.labelsByUser[normalizedEmail] !== normalizedLabel) {
      next.labelsByUser[normalizedEmail] = normalizedLabel;
      changed = true;
    }
  }
  if (Object.keys(next.labelsByUser).length === 0) delete next.labelsByUser;
  if (changed) {
    deviceIdToPreferences.set(normalizedId, next);
    persistPreferencesToDisk();
  }
}

export function getUserThresholds(deviceId: string, email: string): TemperatureThresholds | undefined {
  // Reload from disk to stay in sync across workers
  loadPreferencesFromDisk();
  const pref = deviceIdToPreferences.get(deviceId.trim());
  if (!pref) return undefined;
  const result =
    pref.thresholdsByUser?.[email.trim().toLowerCase()] ??
    // fallback to legacy device-level thresholds if present
    pref.thresholds;
  return result ? { ...result } : undefined;
}

export function setUserThresholds(deviceId: string, email: string, thresholds?: TemperatureThresholds | null) {
  // Reload from disk to stay in sync across workers
  loadPreferencesFromDisk();
  const normalizedId = deviceId.trim();
  if (!normalizedId) return;
  const normalizedEmail = email.trim().toLowerCase();
  const next: DevicePreferences = { ...(deviceIdToPreferences.get(normalizedId) ?? {}) };
  const norm = normalizeThresholds(thresholds ?? undefined);
  next.thresholdsByUser = { ...(next.thresholdsByUser ?? {}) };
  let changed = false;
  if (!norm) {
    if (next.thresholdsByUser[normalizedEmail]) {
      delete next.thresholdsByUser[normalizedEmail];
      changed = true;
    }
  } else {
    const prev = next.thresholdsByUser[normalizedEmail];
    if (!prev || prev.lowC !== norm.lowC || prev.highC !== norm.highC) {
      next.thresholdsByUser[normalizedEmail] = norm;
      changed = true;
    }
  }
  // Clean empty map
  if (Object.keys(next.thresholdsByUser).length === 0) delete next.thresholdsByUser;
  if (changed) {
    deviceIdToPreferences.set(normalizedId, next);
    persistPreferencesToDisk();
  }
}

export function listDevicePreferencesForUser(email: string): Record<string, DevicePreferences> {
  // Reload from disk to stay in sync across workers
  loadPreferencesFromDisk();
  const result: Record<string, DevicePreferences> = {};
  const normalizedEmail = email.trim().toLowerCase();
  for (const [deviceId, pref] of deviceIdToPreferences.entries()) {
    const thresholds = getUserThresholds(deviceId, normalizedEmail);
    const entry: DevicePreferences = { label: getUserLabel(deviceId, normalizedEmail) ?? pref.label };
    if (thresholds) entry.thresholds = thresholds;
    result[deviceId] = entry;
  }
  return result;
}

export function listThresholdsByUser(): Record<string, Record<string, TemperatureThresholds>> {
  // Reload from disk to stay in sync across workers
  loadPreferencesFromDisk();
  const out: Record<string, Record<string, TemperatureThresholds>> = {};
  for (const [deviceId, pref] of deviceIdToPreferences.entries()) {
    const byUser: Record<string, TemperatureThresholds> = {};
    const src = pref.thresholdsByUser ?? {};
    for (const [email, t] of Object.entries(src)) {
      const normalizedEmail = email.trim().toLowerCase();
      if (normalizedEmail) byUser[normalizedEmail] = { ...(t ?? {}) };
    }
    if (Object.keys(byUser).length > 0) out[deviceId] = byUser;
  }
  return out;
}

export function getAllUserThresholds(deviceId: string): Record<string, TemperatureThresholds> {
  // Reload from disk to stay in sync across workers
  loadPreferencesFromDisk();
  const pref = deviceIdToPreferences.get(deviceId.trim());
  if (!pref?.thresholdsByUser) return {};
  const byUser: Record<string, TemperatureThresholds> = {};
  for (const [email, t] of Object.entries(pref.thresholdsByUser)) {
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail) byUser[normalizedEmail] = { ...(t ?? {}) };
  }
  return byUser;
}

export function listDeviceLabelsForUser(email: string): Record<string, string> {
  // Reload from disk to stay in sync across workers
  loadPreferencesFromDisk();
  const result: Record<string, string> = {};
  const normalizedEmail = email.trim().toLowerCase();
  for (const [deviceId, pref] of deviceIdToPreferences.entries()) {
    const label = pref.labelsByUser?.[normalizedEmail] ?? pref.label;
    if (label) result[deviceId] = label;
  }
  return result;
}


