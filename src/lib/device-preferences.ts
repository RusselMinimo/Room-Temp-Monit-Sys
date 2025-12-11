import "server-only";

import type { DevicePreferences, TemperatureThresholds } from "@/types/devices";
import { query, isDatabaseAvailable } from "@/lib/db";

interface DevicePreferenceRow {
  device_id: string;
  label: string | null;
  threshold_low_c: string | null;
  threshold_high_c: string | null;
}

interface UserDeviceLabelRow {
  device_id: string;
  email: string;
  label: string;
}

interface UserDeviceThresholdRow {
  device_id: string;
  email: string;
  low_c: string | null;
  high_c: string | null;
}

// In-memory cache for when database is not available
const deviceIdToPreferences = new Map<string, DevicePreferences>();

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

/**
 * Get device preferences from database
 */
async function getDevicePreferencesFromDB(deviceId: string): Promise<DevicePreferences | undefined> {
  if (!isDatabaseAvailable()) return undefined;

  try {
    // Get base preferences
    const prefResult = await query<DevicePreferenceRow>(
      "SELECT * FROM device_preferences WHERE device_id = $1",
      [deviceId]
    );

    // Get user labels
    const labelResult = await query<UserDeviceLabelRow>(
      "SELECT * FROM user_device_labels WHERE device_id = $1",
      [deviceId]
    );

    // Get user thresholds
    const thresholdResult = await query<UserDeviceThresholdRow>(
      "SELECT * FROM user_device_thresholds WHERE device_id = $1",
      [deviceId]
    );

    const pref: DevicePreferences = {
      label: prefResult[0]?.label ?? undefined,
    };

    // Add legacy device-level thresholds if present
    if (prefResult[0]) {
      const lowC = normalizeThresholdValue(prefResult[0].threshold_low_c);
      const highC = normalizeThresholdValue(prefResult[0].threshold_high_c);
      if (lowC !== undefined || highC !== undefined) {
        pref.thresholds = { lowC, highC };
      }
    }

    // Add user-specific labels
    if (labelResult.length > 0) {
      pref.labelsByUser = {};
      for (const row of labelResult) {
        pref.labelsByUser[row.email] = row.label;
      }
    }

    // Add user-specific thresholds
    if (thresholdResult.length > 0) {
      pref.thresholdsByUser = {};
      for (const row of thresholdResult) {
        const lowC = normalizeThresholdValue(row.low_c);
        const highC = normalizeThresholdValue(row.high_c);
        if (lowC !== undefined || highC !== undefined) {
          pref.thresholdsByUser[row.email] = { lowC, highC };
        }
      }
    }

    return pref;
  } catch (error) {
    console.error("[device-preferences] Failed to get preferences:", error);
    return undefined;
  }
}

/**
 * List all device preferences
 */
export async function listDevicePreferences(): Promise<Record<string, DevicePreferences>> {
  if (!isDatabaseAvailable()) {
    // Fallback to in-memory storage
    const result: Record<string, DevicePreferences> = {};
    for (const [deviceId, pref] of deviceIdToPreferences.entries()) {
      result[deviceId] = { ...pref };
    }
    return result;
  }

  try {
    const result: Record<string, DevicePreferences> = {};

    // Get all base preferences
    const prefResult = await query<DevicePreferenceRow>(
      "SELECT * FROM device_preferences"
    );

    // Get all user labels
    const labelResult = await query<UserDeviceLabelRow>(
      "SELECT * FROM user_device_labels"
    );

    // Get all user thresholds
    const thresholdResult = await query<UserDeviceThresholdRow>(
      "SELECT * FROM user_device_thresholds"
    );

    // Build preferences map
    for (const row of prefResult) {
      const pref: DevicePreferences = {
        label: row.label ?? undefined,
      };

      const lowC = normalizeThresholdValue(row.threshold_low_c);
      const highC = normalizeThresholdValue(row.threshold_high_c);
      if (lowC !== undefined || highC !== undefined) {
        pref.thresholds = { lowC, highC };
      }

      result[row.device_id] = pref;
    }

    // Add user labels
    for (const row of labelResult) {
      if (!result[row.device_id]) {
        result[row.device_id] = { label: undefined };
      }
      if (!result[row.device_id].labelsByUser) {
        result[row.device_id].labelsByUser = {};
      }
      result[row.device_id].labelsByUser![row.email] = row.label;
    }

    // Add user thresholds
    for (const row of thresholdResult) {
      if (!result[row.device_id]) {
        result[row.device_id] = { label: undefined };
      }
      if (!result[row.device_id].thresholdsByUser) {
        result[row.device_id].thresholdsByUser = {};
      }
      const lowC = normalizeThresholdValue(row.low_c);
      const highC = normalizeThresholdValue(row.high_c);
      if (lowC !== undefined || highC !== undefined) {
        result[row.device_id].thresholdsByUser![row.email] = { lowC, highC };
      }
    }

    return result;
  } catch (error) {
    console.error("[device-preferences] Failed to list preferences:", error);
    return {};
  }
}

/**
 * Get preferences for a specific device
 */
export async function getDevicePreferences(deviceId: string): Promise<DevicePreferences | undefined> {
  if (!isDatabaseAvailable()) {
    return deviceIdToPreferences.get(deviceId.trim());
  }

  return await getDevicePreferencesFromDB(deviceId.trim());
}

/**
 * Update device preferences
 */
export async function updateDevicePreferences(
  deviceId: string,
  updates: { label?: string }
): Promise<DevicePreferences | undefined> {
  const normalizedId = deviceId.trim();
  if (!normalizedId) return undefined;

  const label = normalizeLabel(updates.label ?? "");

  if (!isDatabaseAvailable()) {
    // Fallback to in-memory storage
    const next: DevicePreferences = { ...(deviceIdToPreferences.get(normalizedId) ?? {}) };
    if (!label) {
      delete next.label;
    } else {
      next.label = label;
    }
    deviceIdToPreferences.set(normalizedId, next);
    return next;
  }

  try {
    if (label) {
      await query(
        `INSERT INTO device_preferences (device_id, label, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (device_id)
         DO UPDATE SET label = $2, updated_at = NOW()`,
        [normalizedId, label]
      );
    } else {
      await query(
        `UPDATE device_preferences SET label = NULL, updated_at = NOW()
         WHERE device_id = $1`,
        [normalizedId]
      );
    }

    return await getDevicePreferencesFromDB(normalizedId);
  } catch (error) {
    console.error("[device-preferences] Failed to update preferences:", error);
    return undefined;
  }
}

/**
 * List all device labels (admin view)
 */
export async function listDeviceLabels(): Promise<Record<string, string>> {
  const prefs = await listDevicePreferences();
  const result: Record<string, string> = {};
  for (const [deviceId, pref] of Object.entries(prefs)) {
    if (pref.label) result[deviceId] = pref.label;
  }
  return result;
}

/**
 * Get device label
 */
export async function getDeviceLabel(deviceId: string): Promise<string | undefined> {
  const pref = await getDevicePreferences(deviceId.trim());
  return pref?.label;
}

/**
 * Set device label
 */
export async function setDeviceLabel(deviceId: string, label: string) {
  await updateDevicePreferences(deviceId, { label });
}

/**
 * Get user-specific label for a device
 */
export async function getUserLabel(deviceId: string, email: string): Promise<string | undefined> {
  const pref = await getDevicePreferences(deviceId.trim());
  if (!pref) return undefined;
  const normalizedEmail = email.trim().toLowerCase();
  return pref.labelsByUser?.[normalizedEmail] ?? pref.label;
}

/**
 * Set user-specific label for a device
 */
export async function setUserLabel(deviceId: string, email: string, label: string | null | undefined) {
  const normalizedId = deviceId.trim();
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedId) return;

  const normalizedLabel = normalizeLabel(label);

  if (!isDatabaseAvailable()) {
    // Fallback to in-memory storage
    const next: DevicePreferences = { ...(deviceIdToPreferences.get(normalizedId) ?? {}) };
    next.labelsByUser = { ...(next.labelsByUser ?? {}) };
    if (!normalizedLabel) {
      delete next.labelsByUser[normalizedEmail];
    } else {
      next.labelsByUser[normalizedEmail] = normalizedLabel;
    }
    if (Object.keys(next.labelsByUser).length === 0) delete next.labelsByUser;
    deviceIdToPreferences.set(normalizedId, next);
    return;
  }

  try {
    if (normalizedLabel) {
      await query(
        `INSERT INTO user_device_labels (device_id, email, label, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (device_id, email)
         DO UPDATE SET label = $3, updated_at = NOW()`,
        [normalizedId, normalizedEmail, normalizedLabel]
      );
    } else {
      await query(
        `DELETE FROM user_device_labels WHERE device_id = $1 AND email = $2`,
        [normalizedId, normalizedEmail]
      );
    }
  } catch (error) {
    console.error("[device-preferences] Failed to set user label:", error);
  }
}

/**
 * Get user-specific thresholds for a device
 */
export async function getUserThresholds(deviceId: string, email: string): Promise<TemperatureThresholds | undefined> {
  const pref = await getDevicePreferences(deviceId.trim());
  if (!pref) return undefined;
  const normalizedEmail = email.trim().toLowerCase();
  return pref.thresholdsByUser?.[normalizedEmail] ?? pref.thresholds;
}

/**
 * Set user-specific thresholds for a device
 */
export async function setUserThresholds(deviceId: string, email: string, thresholds?: TemperatureThresholds | null) {
  const normalizedId = deviceId.trim();
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedId) return;

  const norm = normalizeThresholds(thresholds ?? undefined);

  if (!isDatabaseAvailable()) {
    // Fallback to in-memory storage
    const next: DevicePreferences = { ...(deviceIdToPreferences.get(normalizedId) ?? {}) };
    next.thresholdsByUser = { ...(next.thresholdsByUser ?? {}) };
    if (!norm) {
      delete next.thresholdsByUser[normalizedEmail];
    } else {
      next.thresholdsByUser[normalizedEmail] = norm;
    }
    if (Object.keys(next.thresholdsByUser).length === 0) delete next.thresholdsByUser;
    deviceIdToPreferences.set(normalizedId, next);
    return;
  }

  try {
    if (norm) {
      await query(
        `INSERT INTO user_device_thresholds (device_id, email, low_c, high_c, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (device_id, email)
         DO UPDATE SET low_c = $3, high_c = $4, updated_at = NOW()`,
        [normalizedId, normalizedEmail, norm.lowC ?? null, norm.highC ?? null]
      );
    } else {
      await query(
        `DELETE FROM user_device_thresholds WHERE device_id = $1 AND email = $2`,
        [normalizedId, normalizedEmail]
      );
    }
  } catch (error) {
    console.error("[device-preferences] Failed to set user thresholds:", error);
  }
}

/**
 * List device preferences for a specific user
 */
export async function listDevicePreferencesForUser(email: string): Promise<Record<string, DevicePreferences>> {
  const allPrefs = await listDevicePreferences();
  const result: Record<string, DevicePreferences> = {};
  const normalizedEmail = email.trim().toLowerCase();

  for (const [deviceId, pref] of Object.entries(allPrefs)) {
    const userLabel = pref.labelsByUser?.[normalizedEmail] ?? pref.label;
    const userThresholds = pref.thresholdsByUser?.[normalizedEmail] ?? pref.thresholds;

    const entry: DevicePreferences = { label: userLabel };
    if (userThresholds) entry.thresholds = userThresholds;
    result[deviceId] = entry;
  }

  return result;
}

/**
 * List all thresholds grouped by user
 */
export async function listThresholdsByUser(): Promise<Record<string, Record<string, TemperatureThresholds>>> {
  const allPrefs = await listDevicePreferences();
  const out: Record<string, Record<string, TemperatureThresholds>> = {};

  for (const [deviceId, pref] of Object.entries(allPrefs)) {
    if (pref.thresholdsByUser) {
      out[deviceId] = { ...pref.thresholdsByUser };
    }
  }

  return out;
}

/**
 * Get all user thresholds for a device
 */
export async function getAllUserThresholds(deviceId: string): Promise<Record<string, TemperatureThresholds>> {
  const pref = await getDevicePreferences(deviceId.trim());
  return pref?.thresholdsByUser ?? {};
}

/**
 * List device labels for a specific user
 */
export async function listDeviceLabelsForUser(email: string): Promise<Record<string, string>> {
  const prefs = await listDevicePreferencesForUser(email);
  const result: Record<string, string> = {};
  
  for (const [deviceId, pref] of Object.entries(prefs)) {
    if (pref.label) result[deviceId] = pref.label;
  }

  return result;
}
