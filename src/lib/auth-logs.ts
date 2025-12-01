import "server-only";

import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = join(process.cwd(), "data");
const AUTH_LOG_FILE = join(DATA_DIR, "auth-logs.json");
const MAX_LOG_ENTRIES = 1000;

export type AuthEventType = "login_success" | "login_failure" | "logout" | "signup";

export interface AuthLogEntry {
  id: string;
  email: string;
  event: AuthEventType;
  ip?: string;
  userAgent?: string;
  timestamp: number;
  details?: string;
}

// Event bus for real-time auth log updates
type AuthLogSubscriber = (entry: AuthLogEntry) => void;
const authLogSubscribers: Set<AuthLogSubscriber> = new Set();

export function subscribeToAuthLogs(subscriber: AuthLogSubscriber): () => void {
  authLogSubscribers.add(subscriber);
  return function unsubscribe() {
    authLogSubscribers.delete(subscriber);
  };
}

function publishAuthLog(entry: AuthLogEntry) {
  for (const subscriber of authLogSubscribers) {
    subscriber(entry);
  }
}

let authLogs: AuthLogEntry[] = [];

function loadLogsFromDisk() {
  if (!existsSync(AUTH_LOG_FILE)) return;
  try {
    const raw = readFileSync(AUTH_LOG_FILE, "utf8");
    if (!raw.trim()) return;
    const parsed = JSON.parse(raw) as AuthLogEntry[];
    if (Array.isArray(parsed)) {
      authLogs = parsed.slice(-MAX_LOG_ENTRIES);
    }
  } catch {
    // ignore malformed file
  }
}

function persistLogsToDisk() {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    const serialized = JSON.stringify(authLogs.slice(-MAX_LOG_ENTRIES), null, 2);
    writeFileSync(AUTH_LOG_FILE, serialized, "utf8");
  } catch {
    // swallow fs errors
  }
}

loadLogsFromDisk();

export function appendAuthLog(entry: Omit<AuthLogEntry, "id" | "timestamp"> & { timestamp?: number }) {
  // Reload from disk to stay in sync across workers/processes
  loadLogsFromDisk();
  
  const record: AuthLogEntry = {
    id: randomUUID(),
    timestamp: entry.timestamp ?? Date.now(),
    ...entry,
  };
  authLogs.push(record);
  if (authLogs.length > MAX_LOG_ENTRIES) authLogs = authLogs.slice(-MAX_LOG_ENTRIES);
  persistLogsToDisk();
  
  // Publish to real-time subscribers
  publishAuthLog(record);
  
  return record;
}

export function listAuthLogs(limit = 200): AuthLogEntry[] {
  // Reload from disk to stay in sync across workers/processes
  loadLogsFromDisk();
  return authLogs.slice(-limit).reverse();
}

export function deleteAuthLogById(id: string): boolean {
  loadLogsFromDisk();
  const index = authLogs.findIndex((e) => e.id === id);
  if (index === -1) return false;
  authLogs.splice(index, 1);
  persistLogsToDisk();
  return true;
}

export function clearAuthLogs(): number {
  loadLogsFromDisk();
  const count = authLogs.length;
  authLogs = [];
  persistLogsToDisk();
  return count;
}

export interface UserAuthStatus {
  email: string;
  isOnline: boolean;
  lastEvent: AuthEventType;
  lastEventTime: string; // ISO string
}

export function getUserAuthStatuses(): UserAuthStatus[] {
  loadLogsFromDisk();
  
  // Group logs by email and find the most recent login/logout/signup event for each user
  const latestEventByUser = new Map<string, AuthLogEntry>();
  
  for (const log of authLogs) {
    // Only consider login_success, logout, and signup events (not login_failure)
    if (log.event !== "login_success" && log.event !== "logout" && log.event !== "signup") {
      continue;
    }
    
    const normalizedEmail = log.email.trim().toLowerCase();
    const existing = latestEventByUser.get(normalizedEmail);
    
    // Keep the most recent event
    if (!existing || log.timestamp > existing.timestamp) {
      latestEventByUser.set(normalizedEmail, log);
    }
  }
  
  // Convert to UserAuthStatus array
  const statuses: UserAuthStatus[] = [];
  for (const [email, log] of latestEventByUser.entries()) {
    statuses.push({
      email,
      isOnline: log.event === "login_success" || log.event === "signup",
      lastEvent: log.event,
      lastEventTime: new Date(log.timestamp).toISOString(),
    });
  }
  
  return statuses;
}


