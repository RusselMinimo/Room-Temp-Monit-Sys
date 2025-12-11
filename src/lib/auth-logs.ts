import "server-only";

import { randomUUID } from "node:crypto";
import { query, isDatabaseAvailable } from "@/lib/db";

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

interface AuthLogRow {
  id: string;
  email: string;
  event: string;
  ip: string | null;
  user_agent: string | null;
  timestamp: string;
  details: string | null;
}

// Event bus for real-time auth log updates
export type AuthLogEvent =
  | { type: "new"; entry: AuthLogEntry }
  | { type: "delete"; id: string }
  | { type: "clear" };

type AuthLogSubscriber = (event: AuthLogEvent) => void;
const authLogSubscribers: Set<AuthLogSubscriber> = new Set();

// In-memory cache for when database is not available
let authLogs: AuthLogEntry[] = [];

export function subscribeToAuthLogs(subscriber: AuthLogSubscriber): () => void {
  authLogSubscribers.add(subscriber);
  return function unsubscribe() {
    authLogSubscribers.delete(subscriber);
  };
}

function publishAuthLogEvent(event: AuthLogEvent) {
  for (const subscriber of authLogSubscribers) {
    subscriber(event);
  }
}

function rowToAuthLog(row: AuthLogRow): AuthLogEntry {
  return {
    id: row.id,
    email: row.email,
    event: row.event as AuthEventType,
    ip: row.ip ?? undefined,
    userAgent: row.user_agent ?? undefined,
    timestamp: parseInt(row.timestamp, 10),
    details: row.details ?? undefined,
  };
}

/**
 * Append a new auth log entry
 */
export async function appendAuthLog(
  entry: Omit<AuthLogEntry, "id" | "timestamp"> & { timestamp?: number }
): Promise<AuthLogEntry> {
  const record: AuthLogEntry = {
    id: randomUUID(),
    timestamp: entry.timestamp ?? Date.now(),
    ...entry,
  };

  // Publish to real-time subscribers first
  publishAuthLogEvent({ type: "new", entry: record });

  if (!isDatabaseAvailable()) {
    // Fallback to in-memory storage
    console.warn("[auth-logs] Database not available, using in-memory storage");
    authLogs.push(record);
    if (authLogs.length > MAX_LOG_ENTRIES) {
      authLogs = authLogs.slice(-MAX_LOG_ENTRIES);
    }
    return record;
  }

  try {
    await query(
      `INSERT INTO auth_logs (id, email, event, ip, user_agent, timestamp, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        record.id,
        record.email,
        record.event,
        record.ip ?? null,
        record.userAgent ?? null,
        record.timestamp.toString(),
        record.details ?? null,
      ]
    );

    // Cleanup old logs to maintain MAX_LOG_ENTRIES limit
    await query(
      `DELETE FROM auth_logs 
       WHERE id NOT IN (
         SELECT id FROM auth_logs 
         ORDER BY timestamp DESC 
         LIMIT $1
       )`,
      [MAX_LOG_ENTRIES]
    );

    return record;
  } catch (error) {
    console.error("[auth-logs] Failed to append log:", error);
    // Fallback to in-memory storage on error
    authLogs.push(record);
    if (authLogs.length > MAX_LOG_ENTRIES) {
      authLogs = authLogs.slice(-MAX_LOG_ENTRIES);
    }
    return record;
  }
}

/**
 * List auth logs (most recent first)
 */
export async function listAuthLogs(limit = 200): Promise<AuthLogEntry[]> {
  if (!isDatabaseAvailable()) {
    // Fallback to in-memory storage
    return authLogs.slice(-limit).reverse();
  }

  try {
    const result = await query<AuthLogRow>(
      `SELECT * FROM auth_logs 
       ORDER BY timestamp DESC 
       LIMIT $1`,
      [limit]
    );

    return result.map(rowToAuthLog);
  } catch (error) {
    console.error("[auth-logs] Failed to list logs:", error);
    return [];
  }
}

/**
 * Delete auth log by ID
 */
export async function deleteAuthLogById(id: string): Promise<boolean> {
  if (!isDatabaseAvailable()) {
    // Fallback to in-memory storage
    const index = authLogs.findIndex((e) => e.id === id);
    if (index === -1) return false;
    authLogs.splice(index, 1);
    publishAuthLogEvent({ type: "delete", id });
    return true;
  }

  try {
    const result = await query(
      "DELETE FROM auth_logs WHERE id = $1",
      [id]
    );

    publishAuthLogEvent({ type: "delete", id });
    return true;
  } catch (error) {
    console.error("[auth-logs] Failed to delete log:", error);
    return false;
  }
}

/**
 * Clear all auth logs
 */
export async function clearAuthLogs(): Promise<number> {
  if (!isDatabaseAvailable()) {
    // Fallback to in-memory storage
    const count = authLogs.length;
    authLogs = [];
    publishAuthLogEvent({ type: "clear" });
    return count;
  }

  try {
    const result = await query<{ count: string }>(
      `WITH deleted AS (
         DELETE FROM auth_logs RETURNING id
       )
       SELECT COUNT(*) as count FROM deleted`
    );

    const count = parseInt(result[0]?.count ?? "0", 10);
    publishAuthLogEvent({ type: "clear" });
    return count;
  } catch (error) {
    console.error("[auth-logs] Failed to clear logs:", error);
    return 0;
  }
}

/**
 * User auth status interface
 */
export interface UserAuthStatus {
  email: string;
  isOnline: boolean;
  lastEvent: AuthEventType;
  lastEventTime: string; // ISO string
}

/**
 * Get user auth statuses
 */
export async function getUserAuthStatuses(): Promise<UserAuthStatus[]> {
  if (!isDatabaseAvailable()) {
    // Fallback to in-memory storage
    const latestEventByUser = new Map<string, AuthLogEntry>();

    for (const log of authLogs) {
      if (
        log.event !== "login_success" &&
        log.event !== "logout" &&
        log.event !== "signup"
      ) {
        continue;
      }

      const normalizedEmail = log.email.trim().toLowerCase();
      const existing = latestEventByUser.get(normalizedEmail);

      if (!existing || log.timestamp > existing.timestamp) {
        latestEventByUser.set(normalizedEmail, log);
      }
    }

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

  try {
    // Get the latest relevant event for each user
    const result = await query<AuthLogRow>(
      `SELECT DISTINCT ON (email) *
       FROM auth_logs
       WHERE event IN ('login_success', 'logout', 'signup')
       ORDER BY email, timestamp DESC`
    );

    const statuses: UserAuthStatus[] = result.map((row) => ({
      email: row.email,
      isOnline: row.event === "login_success" || row.event === "signup",
      lastEvent: row.event as AuthEventType,
      lastEventTime: new Date(parseInt(row.timestamp, 10)).toISOString(),
    }));

    return statuses;
  } catch (error) {
    console.error("[auth-logs] Failed to get user auth statuses:", error);
    return [];
  }
}
