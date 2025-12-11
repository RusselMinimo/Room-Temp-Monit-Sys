import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";

import { isAdminUser, verifyPassword } from "@/lib/users";
import { query, isDatabaseAvailable } from "@/lib/db";

interface SessionRecord {
  token: string;
  email: string;
  issuedAt: number;
  expiresAt: number;
}

interface SessionRow {
  token: string;
  email: string;
  issued_at: string;
  expires_at: string;
}

const SESSION_COOKIE_NAME = "iot_session";
const SESSION_TTL_SECONDS = Number(process.env.AUTH_SESSION_TTL_SECONDS ?? 60 * 60 * 8); // 8 hours

// In-memory cache for when database is not available
const sessionStore = new Map<string, SessionRecord>();

function rowToSession(row: SessionRow): SessionRecord {
  return {
    token: row.token,
    email: row.email,
    issuedAt: parseInt(row.issued_at, 10),
    expiresAt: parseInt(row.expires_at, 10),
  };
}

/**
 * Prune expired sessions from database
 */
async function pruneExpiredSessionsFromDB(): Promise<void> {
  if (!isDatabaseAvailable()) return;

  try {
    const now = Date.now();
    await query("DELETE FROM sessions WHERE expires_at <= $1", [now.toString()]);
  } catch (error) {
    console.error("[auth] Failed to prune expired sessions:", error);
  }
}

/**
 * Prune expired sessions from in-memory store
 */
function pruneExpiredSessionsFromMemory(): void {
  const now = Date.now();
  for (const [token, session] of sessionStore.entries()) {
    if (session.expiresAt <= now) {
      sessionStore.delete(token);
    }
  }
}

/**
 * Verify user credentials
 */
export async function verifyUserCredentials(email: string, password: string): Promise<boolean> {
  if (!email || !password || typeof email !== "string" || typeof password !== "string") {
    return false;
  }
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPassword = password.trim();
  if (!normalizedEmail || !normalizedPassword) return false;
  return await verifyPassword(normalizedEmail, normalizedPassword);
}

/**
 * Persist session cookie
 */
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

/**
 * Create a new session
 */
export async function createSession(email: string): Promise<SessionRecord> {
  const token = randomUUID();
  const issuedAt = Date.now();
  const expiresAt = issuedAt + SESSION_TTL_SECONDS * 1000;
  const normalizedEmail = email.trim().toLowerCase();

  const record: SessionRecord = {
    token,
    email: normalizedEmail,
    issuedAt,
    expiresAt,
  };

  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/a101187a-72de-4f32-8b8f-fe2762640cce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.ts:97',message:'createSession entry',data:{email:normalizedEmail,token,storeSizeBefore:sessionStore.size,storeKeysBefore:Array.from(sessionStore.keys())},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion

  if (!isDatabaseAvailable()) {
    // Fallback to in-memory storage
    console.warn("[auth] Database not available, using in-memory sessions");
    sessionStore.set(token, record);
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/a101187a-72de-4f32-8b8f-fe2762640cce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.ts:113',message:'createSession in-memory set',data:{token,storeSizeAfter:sessionStore.size,storeKeysAfter:Array.from(sessionStore.keys()),savedRecord:record},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    persistSessionCookie(token);
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/a101187a-72de-4f32-8b8f-fe2762640cce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.ts:115',message:'createSession cookie persisted',data:{token},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    return record;
  }

  try {
    await pruneExpiredSessionsFromDB();

    await query(
      `INSERT INTO sessions (token, email, issued_at, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [token, normalizedEmail, issuedAt.toString(), expiresAt.toString()]
    );

    persistSessionCookie(token);
    return record;
  } catch (error) {
    console.error("[auth] Failed to create session:", error);
    // Fallback to in-memory storage
    sessionStore.set(token, record);
    persistSessionCookie(token);
    return record;
  }
}

/**
 * Get current session
 */
export async function getSession(): Promise<SessionRecord | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  // #region agent log
  console.log('[DEBUG getSession] Cookie check', { hasToken: !!token, tokenPreview: token ? token.substring(0, 8) + '...' : null });
  fetch('http://127.0.0.1:7244/ingest/a101187a-72de-4f32-8b8f-fe2762640cce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.ts:142',message:'getSession entry',data:{hasToken:!!token,token,tokenPreview:token?token.substring(0,8)+'...':null,storeSize:sessionStore.size,storeKeys:Array.from(sessionStore.keys())},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  if (!token) return null;

  if (!isDatabaseAvailable()) {
    // Fallback to in-memory storage
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/a101187a-72de-4f32-8b8f-fe2762640cce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.ts:151',message:'getSession before prune',data:{token,storeSizeBefore:sessionStore.size,storeKeysBefore:Array.from(sessionStore.keys()),now:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    pruneExpiredSessionsFromMemory();
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/a101187a-72de-4f32-8b8f-fe2762640cce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.ts:152',message:'getSession after prune',data:{token,storeSizeAfter:sessionStore.size,storeKeysAfter:Array.from(sessionStore.keys()),lookupToken:token},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    const session = sessionStore.get(token);
    // #region agent log
    console.log('[DEBUG getSession] In-memory check', { hasSession: !!session, expiresAt: session?.expiresAt, now: Date.now(), isExpired: session ? session.expiresAt <= Date.now() : null });
    fetch('http://127.0.0.1:7244/ingest/a101187a-72de-4f32-8b8f-fe2762640cce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'auth.ts:153',message:'getSession lookup result',data:{token,hasSession:!!session,sessionEmail:session?.email,sessionExpiresAt:session?.expiresAt,now:Date.now(),isExpired:session?session.expiresAt<=Date.now():null,allStoreEntries:Array.from(sessionStore.entries()).map(([k,v])=>({token:k,email:v.email,expiresAt:v.expiresAt}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    if (!session) return null;
    if (session.expiresAt <= Date.now()) {
      sessionStore.delete(token);
      return null;
    }
    return session;
  }

  try {
    await pruneExpiredSessionsFromDB();

    const result = await query<SessionRow>(
      "SELECT * FROM sessions WHERE token = $1",
      [token]
    );

    if (result.length === 0) return null;

    const session = rowToSession(result[0]);

    if (session.expiresAt <= Date.now()) {
      await query("DELETE FROM sessions WHERE token = $1", [token]);
      return null;
    }

    return session;
  } catch (error) {
    console.error("[auth] Failed to get session:", error);
    return null;
  }
}

/**
 * Synchronous version for backwards compatibility (uses cached data)
 */
export function getSessionSync(): SessionRecord | null {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  pruneExpiredSessionsFromMemory();
  const session = sessionStore.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessionStore.delete(token);
    return null;
  }
  return session;
}

/**
 * Require a valid session (redirect to login if not authenticated)
 */
export async function requireSession(): Promise<SessionRecord> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/**
 * Synchronous version for backwards compatibility
 */
export function requireSessionSync(): SessionRecord {
  const session = getSessionSync();
  if (!session) redirect("/login");
  return session;
}

/**
 * Check if email is admin
 */
export function isAdminEmail(email: string): boolean {
  return isAdminUser(email);
}

/**
 * Require admin session (redirect to user dashboard if not admin)
 */
export async function requireAdminSession(): Promise<SessionRecord> {
  const session = await requireSession();
  if (!isAdminEmail(session.email)) redirect("/user-dashboard");
  return session;
}

/**
 * Synchronous version for backwards compatibility
 */
export function requireAdminSessionSync(): SessionRecord {
  const session = requireSessionSync();
  if (!isAdminEmail(session.email)) redirect("/user-dashboard");
  return session;
}

/**
 * Check if any non-admin has active session
 */
export async function hasActiveNonAdminSession(): Promise<boolean> {
  if (!isDatabaseAvailable()) {
    // Fallback to in-memory storage
    pruneExpiredSessionsFromMemory();
    for (const session of sessionStore.values()) {
      if (!isAdminEmail(session.email)) {
        return true;
      }
    }
    return false;
  }

  try {
    await pruneExpiredSessionsFromDB();

    const result = await query<{ count: string }>(
      `SELECT COUNT(DISTINCT email) as count 
       FROM sessions 
       WHERE expires_at > $1`,
      [Date.now().toString()]
    );

    const count = parseInt(result[0]?.count ?? "0", 10);
    
    // Need to check if any of these are non-admin
    if (count === 0) return false;

    const sessions = await query<{ email: string }>(
      `SELECT DISTINCT email FROM sessions WHERE expires_at > $1`,
      [Date.now().toString()]
    );

    for (const row of sessions) {
      if (!isAdminEmail(row.email)) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error("[auth] Failed to check for active non-admin sessions:", error);
    return false;
  }
}

/**
 * List all active user emails (excluding admins)
 */
export async function listActiveUserEmails(): Promise<string[]> {
  if (!isDatabaseAvailable()) {
    // Fallback to in-memory storage
    pruneExpiredSessionsFromMemory();
    const activeEmails = new Set<string>();
    const now = Date.now();

    for (const session of sessionStore.values()) {
      if (session.expiresAt > now && !isAdminEmail(session.email)) {
        activeEmails.add(session.email);
      }
    }

    return Array.from(activeEmails);
  }

  try {
    await pruneExpiredSessionsFromDB();

    const result = await query<{ email: string }>(
      `SELECT DISTINCT email FROM sessions WHERE expires_at > $1`,
      [Date.now().toString()]
    );

    const emails: string[] = [];
    for (const row of result) {
      if (!isAdminEmail(row.email)) {
        emails.push(row.email);
      }
    }

    return emails;
  } catch (error) {
    console.error("[auth] Failed to list active user emails:", error);
    return [];
  }
}

/**
 * Get count of active sessions (unique users, excluding admins)
 */
export async function getActiveSessionCount(): Promise<number> {
  const emails = await listActiveUserEmails();
  return emails.length;
}

/**
 * Destroy current session (logout)
 */
export async function destroySession() {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    if (isDatabaseAvailable()) {
      try {
        await query("DELETE FROM sessions WHERE token = $1", [token]);
      } catch (error) {
        console.error("[auth] Failed to delete session:", error);
      }
    }
    sessionStore.delete(token);
  }

  // Delete the cookie
  cookieStore.delete(SESSION_COOKIE_NAME);
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
