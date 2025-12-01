import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = join(process.cwd(), "data");
const ASSIGNMENTS_FILE = join(DATA_DIR, "user-assignments.json");

// email (lowercased) -> deviceId
const emailToDeviceId = new Map<string, string>();

function loadFromDisk() {
  try {
    if (!existsSync(ASSIGNMENTS_FILE)) return;
    const raw = readFileSync(ASSIGNMENTS_FILE, "utf8");
    if (!raw.trim()) return;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const [email, deviceId] of Object.entries(parsed)) {
      if (typeof email === "string" && typeof deviceId === "string" && deviceId.trim()) {
        emailToDeviceId.set(email.trim().toLowerCase(), deviceId.trim());
      }
    }
  } catch {
    // ignore malformed files
  }
}

function persistToDisk() {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    const out: Record<string, string> = {};
    for (const [email, deviceId] of emailToDeviceId.entries()) {
      out[email] = deviceId;
    }
    writeFileSync(ASSIGNMENTS_FILE, JSON.stringify(out, null, 2), "utf8");
  } catch {
    // swallow on purpose
  }
}

loadFromDisk();

export function getAssignedDeviceId(email: string): string | undefined {
  return emailToDeviceId.get(email.trim().toLowerCase());
}

export function setAssignment(email: string, deviceId?: string | null) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return;
  if (!deviceId || !deviceId.trim()) {
    if (emailToDeviceId.delete(normalizedEmail)) {
      persistToDisk();
    }
    return;
  }
  const normalizedDeviceId = deviceId.trim();
  const prev = emailToDeviceId.get(normalizedEmail);
  if (prev !== normalizedDeviceId) {
    emailToDeviceId.set(normalizedEmail, normalizedDeviceId);
    persistToDisk();
  }
}

export function listAssignments(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [email, deviceId] of emailToDeviceId.entries()) {
    out[email] = deviceId;
  }
  return out;
}


