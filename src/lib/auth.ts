import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";

import { isAdminUser, verifyPassword } from "@/lib/users";
import { storage } from "@/lib/storage";

interface SessionRecord {
  token: string;
  email: string;
  issuedAt: number;
  expiresAt: number;
}

const SESSION_COOKIE_NAME = "iot_session";
const SESSION_TTL_SECONDS = Number(process.env.AUTH_SESSION_TTL_SECONDS ?? 60 * 60 * 8); // 8 hours
const SESSIONS_STORAGE_KEY = "sessions";
const sessionStore = new Map<string, SessionRecord>();

async function loadSessionsFromStorage() {
  // Clear existing sessions to ensure deleted sessions are removed
  sessionStore.clear();
  const sessions = await storage.read<SessionRecord[]>(SESSIONS_STORAGE_KEY);
  if (!sessions || !Array.isArray(sessions)) return;
  for (const record of sessions) {
    if (record?.token && record?.email) {
      sessionStore.set(record.token, record);
    }
  }
}

async function persistSessionsToStorage() {
  const sessions = Array.from(sessionStore.values());
  await storage.write(SESSIONS_STORAGE_KEY, sessions);
}

async function pruneExpiredSessions() {
  let dirty = false;
  const now = Date.now();
  for (const [token, session] of sessionStore.entries()) {
    if (session.expiresAt <= now) {
      sessionStore.delete(token);
      dirty = true;
    }
  }
  if (dirty) await persistSessionsToStorage();
}

// Initialize sessions in the background
loadSessionsFromStorage()
  .then(() => pruneExpiredSessions())
  .catch(() => {
    // If loading fails, continue with empty session store
  });

export async function verifyUserCredentials(email: string, password: string): Promise<boolean> {
  if (!email || !password || typeof email !== "string" || typeof password !== "string") {
    return false;
  }
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPassword = password.trim();
  if (!normalizedEmail || !normalizedPassword) return false;
  return await verifyPassword(normalizedEmail, normalizedPassword);
}

function persistSessionCookie(token: string) {
  const cookieStore = cookies();
  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function createSession(email: string): Promise<SessionRecord> {
  // Reload from storage to stay in sync across workers
  await loadSessionsFromStorage();
  const token = randomUUID();
  const issuedAt = Date.now();
  const expiresAt = issuedAt + SESSION_TTL_SECONDS * 1000;
  // Normalize email to lowercase for consistent comparison
  const normalizedEmail = email.trim().toLowerCase();
  const record: SessionRecord = { token, email: normalizedEmail, issuedAt, expiresAt };
  sessionStore.set(token, record);
  persistSessionCookie(token);
  await persistSessionsToStorage();
  return record;
}

export async function getSession(): Promise<SessionRecord | null> {
  // Reload from storage to stay in sync across workers
  await loadSessionsFromStorage();
  await pruneExpiredSessions();
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const session = sessionStore.get(token);
  if (!session) {
    return null;
  }
  if (session.expiresAt <= Date.now()) {
    sessionStore.delete(token);
    await persistSessionsToStorage();
    return null;
  }
  return session;
}

// Synchronous version for backwards compatibility (uses cached data)
export function getSessionSync(): SessionRecord | null {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const session = sessionStore.get(token);
  if (!session) {
    return null;
  }
  if (session.expiresAt <= Date.now()) {
    sessionStore.delete(token);
    return null;
  }
  return session;
}

export async function requireSession(): Promise<SessionRecord> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

// Synchronous version for backwards compatibility
export function requireSessionSync(): SessionRecord {
  const session = getSessionSync();
  if (!session) redirect("/login");
  return session;
}

export function isAdminEmail(email: string): boolean {
  return isAdminUser(email);
}

export async function requireAdminSession(): Promise<SessionRecord> {
  const session = await requireSession();
  if (!isAdminEmail(session.email)) redirect("/user-dashboard");
  return session;
}

// Synchronous version for backwards compatibility
export function requireAdminSessionSync(): SessionRecord {
  const session = requireSessionSync();
  if (!isAdminEmail(session.email)) redirect("/user-dashboard");
  return session;
}

export async function hasActiveNonAdminSession(): Promise<boolean> {
  // Reload from storage and prune to ensure we only consider active sessions
  await loadSessionsFromStorage();
  await pruneExpiredSessions();
  for (const session of sessionStore.values()) {
    if (!isAdminEmail(session.email)) {
      return true;
    }
  }
  return false;
}

export async function listActiveUserEmails(): Promise<string[]> {
  // Reload from storage and prune to ensure we only consider active sessions
  await loadSessionsFromStorage();
  await pruneExpiredSessions();
  const activeEmails = new Set<string>();
  const now = Date.now();
  for (const session of sessionStore.values()) {
    // Only count non-expired sessions
    if (session.expiresAt > now) {
      // Emails are already normalized to lowercase when stored
      if (!isAdminEmail(session.email)) {
        activeEmails.add(session.email);
      }
    }
  }
  return Array.from(activeEmails);
}

export async function getActiveSessionCount(): Promise<number> {
  // Reload from storage and prune to ensure we only consider active sessions
  await loadSessionsFromStorage();
  await pruneExpiredSessions();
  // Use listActiveUserEmails to get unique user count (not total sessions)
  const emails = await listActiveUserEmails();
  return emails.length;
}

export async function destroySession() {
  // Reload from storage to stay in sync across workers
  await loadSessionsFromStorage();
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    sessionStore.delete(token);
    await persistSessionsToStorage();
  }
  // Delete the cookie by setting it to expired
  cookieStore.delete(SESSION_COOKIE_NAME);
  // Also explicitly set an expired cookie as fallback
  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
}


