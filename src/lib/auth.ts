import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { isAdminUser, verifyPassword } from "@/lib/users";

interface SessionRecord {
  token: string;
  email: string;
  issuedAt: number;
  expiresAt: number;
}

const SESSION_COOKIE_NAME = "iot_session";
const SESSION_TTL_SECONDS = Number(process.env.AUTH_SESSION_TTL_SECONDS ?? 60 * 60 * 8); // 8 hours
const DATA_DIR = join(process.cwd(), "data");
const SESSIONS_FILE = join(DATA_DIR, "sessions.json");
const sessionStore = new Map<string, SessionRecord>();

function loadSessionsFromDisk() {
  // Clear existing sessions to ensure deleted sessions are removed
  sessionStore.clear();
  if (!existsSync(SESSIONS_FILE)) return;
  try {
    const raw = readFileSync(SESSIONS_FILE, "utf8");
    if (!raw.trim()) return;
    const parsed = JSON.parse(raw) as SessionRecord[];
    if (Array.isArray(parsed)) {
      for (const record of parsed) {
        if (record?.token && record?.email) {
          sessionStore.set(record.token, record);
        }
      }
    }
  } catch {
    // ignore malformed file
  }
}

function persistSessionsToDisk() {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    const serialized = JSON.stringify(Array.from(sessionStore.values()), null, 2);
    writeFileSync(SESSIONS_FILE, serialized, "utf8");
  } catch {
    // ignore fs errors
  }
}

function pruneExpiredSessions() {
  let dirty = false;
  const now = Date.now();
  for (const [token, session] of sessionStore.entries()) {
    if (session.expiresAt <= now) {
      sessionStore.delete(token);
      dirty = true;
    }
  }
  if (dirty) persistSessionsToDisk();
}

loadSessionsFromDisk();
pruneExpiredSessions();

export async function verifyUserCredentials(email: string, password: string): Promise<boolean> {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPassword = password.trim();
  if (!normalizedEmail || !normalizedPassword) return false;
  return verifyPassword(normalizedEmail, normalizedPassword);
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
  // Reload from disk to stay in sync across workers
  loadSessionsFromDisk();
  const token = randomUUID();
  const issuedAt = Date.now();
  const expiresAt = issuedAt + SESSION_TTL_SECONDS * 1000;
  // Normalize email to lowercase for consistent comparison
  const normalizedEmail = email.trim().toLowerCase();
  const record: SessionRecord = { token, email: normalizedEmail, issuedAt, expiresAt };
  sessionStore.set(token, record);
  persistSessionCookie(token);
  persistSessionsToDisk();
  return record;
}

export function getSession(): SessionRecord | null {
  // Reload from disk to stay in sync across workers
  loadSessionsFromDisk();
  pruneExpiredSessions();
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

export function requireSession(): SessionRecord {
  const session = getSession();
  if (!session) redirect("/login");
  return session;
}

export function isAdminEmail(email: string): boolean {
  return isAdminUser(email);
}

export function requireAdminSession(): SessionRecord {
  const session = requireSession();
  if (!isAdminEmail(session.email)) redirect("/user-dashboard");
  return session;
}

export function hasActiveNonAdminSession(): boolean {
  // Reload from disk and prune to ensure we only consider active sessions
  loadSessionsFromDisk();
  pruneExpiredSessions();
  for (const session of sessionStore.values()) {
    if (!isAdminEmail(session.email)) {
      return true;
    }
  }
  return false;
}

export function listActiveUserEmails(): string[] {
  // Reload from disk and prune to ensure we only consider active sessions
  loadSessionsFromDisk();
  pruneExpiredSessions();
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

export function getActiveSessionCount(): number {
  // Reload from disk and prune to ensure we only consider active sessions
  loadSessionsFromDisk();
  pruneExpiredSessions();
  // Use listActiveUserEmails to get unique user count (not total sessions)
  return listActiveUserEmails().length;
}

export function destroySession() {
  // Reload from disk to stay in sync across workers
  loadSessionsFromDisk();
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    sessionStore.delete(token);
    persistSessionsToDisk();
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


