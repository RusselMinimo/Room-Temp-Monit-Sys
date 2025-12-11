import "server-only";

import { query, isDatabaseAvailable } from "@/lib/db";

interface AssignmentRow {
  email: string;
  device_id: string;
}

// In-memory cache for when database is not available
const emailToDeviceId = new Map<string, string>();

/**
 * Get assigned device ID for a user
 */
export async function getAssignedDeviceId(email: string): Promise<string | undefined> {
  if (!email || typeof email !== "string") return undefined;
  const normalizedEmail = email.trim().toLowerCase();

  if (!isDatabaseAvailable()) {
    // Fallback to in-memory storage
    return emailToDeviceId.get(normalizedEmail);
  }

  try {
    const result = await query<AssignmentRow>(
      "SELECT device_id FROM device_assignments WHERE email = $1",
      [normalizedEmail]
    );

    if (result.length === 0) return undefined;
    return result[0].device_id;
  } catch (error) {
    console.error("[assignments] Failed to get assignment:", error);
    return undefined;
  }
}

/**
 * Set device assignment for a user
 */
export async function setAssignment(email: string, deviceId?: string | null) {
  if (!email || typeof email !== "string") return;
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return;

  if (!deviceId || typeof deviceId !== "string" || !deviceId.trim()) {
    // Remove assignment
    if (!isDatabaseAvailable()) {
      emailToDeviceId.delete(normalizedEmail);
      return;
    }

    try {
      await query(
        "DELETE FROM device_assignments WHERE email = $1",
        [normalizedEmail]
      );
    } catch (error) {
      console.error("[assignments] Failed to delete assignment:", error);
    }
    return;
  }

  const normalizedDeviceId = deviceId.trim();

  if (!isDatabaseAvailable()) {
    // Fallback to in-memory storage
    emailToDeviceId.set(normalizedEmail, normalizedDeviceId);
    return;
  }

  try {
    await query(
      `INSERT INTO device_assignments (email, device_id, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (email)
       DO UPDATE SET device_id = $2, updated_at = NOW()`,
      [normalizedEmail, normalizedDeviceId]
    );
  } catch (error) {
    console.error("[assignments] Failed to set assignment:", error);
  }
}

/**
 * List all device assignments
 */
export async function listAssignments(): Promise<Record<string, string>> {
  if (!isDatabaseAvailable()) {
    // Fallback to in-memory storage
    const out: Record<string, string> = {};
    for (const [email, deviceId] of emailToDeviceId.entries()) {
      out[email] = deviceId;
    }
    return out;
  }

  try {
    const result = await query<AssignmentRow>(
      "SELECT email, device_id FROM device_assignments"
    );

    const out: Record<string, string> = {};
    for (const row of result) {
      out[row.email] = row.device_id;
    }
    return out;
  } catch (error) {
    console.error("[assignments] Failed to list assignments:", error);
    return {};
  }
}
