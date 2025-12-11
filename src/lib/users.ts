import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { query, isDatabaseAvailable } from "@/lib/db";

export interface UserRecord {
  email: string;
  passwordHash: string;
  salt?: string;
  createdAt: number;
  role?: "admin" | "user";
}

interface UserRow {
  email: string;
  password_hash: string;
  salt: string | null;
  created_at: string;
  role: string;
}

const DEFAULT_EMAIL = (process.env.AUTH_EMAIL?.trim() || "admin@iot.local").toLowerCase();
const DEFAULT_PASSWORD = process.env.AUTH_PASSWORD || "iot-room-pass";
const DEFAULT_PASSWORD_HASH = process.env.AUTH_PASSWORD_HASH?.trim();

// In-memory cache for when database is not available
const userStore = new Map<string, UserRecord>();

function normalizeEmail(email: string): string {
  if (!email || typeof email !== "string") {
    throw new Error("Email must be a non-empty string");
  }
  return email.trim().toLowerCase();
}

function hashPassword(password: string, salt?: string) {
  const nextSalt = salt ?? randomBytes(16).toString("hex");
  const hash = createHash("sha256").update(`${nextSalt}:${password}`).digest("hex");
  return { salt: nextSalt, hash };
}

function rowToUser(row: UserRow): UserRecord {
  return {
    email: row.email,
    passwordHash: row.password_hash,
    salt: row.salt ?? undefined,
    createdAt: parseInt(row.created_at, 10),
    role: (row.role as "admin" | "user") ?? "user",
  };
}

/**
 * Ensure default admin user exists in database
 */
async function ensureDefaultUserInDB(): Promise<boolean> {
  if (!isDatabaseAvailable()) return false;

  try {
    // Check if default user exists
    const existing = await query<UserRow>(
      "SELECT * FROM users WHERE email = $1",
      [DEFAULT_EMAIL]
    );

    if (existing.length === 0) {
      // Create default user
      const { salt, hash } = DEFAULT_PASSWORD_HASH
        ? { salt: "", hash: DEFAULT_PASSWORD_HASH }
        : hashPassword(DEFAULT_PASSWORD);

      await query(
        `INSERT INTO users (email, password_hash, salt, created_at, role)
         VALUES ($1, $2, $3, $4, $5)`,
        [DEFAULT_EMAIL, hash, salt, Date.now().toString(), "admin"]
      );
      return true;
    }

    // Update existing user to ensure it's admin
    const user = existing[0];
    let needsUpdate = false;
    let newHash = user.password_hash;
    let newSalt = user.salt;

    if (user.role !== "admin") {
      needsUpdate = true;
    }

    if (DEFAULT_PASSWORD_HASH) {
      if (user.password_hash !== DEFAULT_PASSWORD_HASH || user.salt) {
        newHash = DEFAULT_PASSWORD_HASH;
        newSalt = "";
        needsUpdate = true;
      }
    } else if (DEFAULT_PASSWORD && user.salt) {
      // Verify password
      const { hash } = hashPassword(DEFAULT_PASSWORD, user.salt);
      const expected = Buffer.from(user.password_hash, "hex");
      const given = Buffer.from(hash, "hex");
      const passwordMatches =
        expected.length === given.length && timingSafeEqual(expected, given);

      if (!passwordMatches) {
        const { salt, hash: newHashValue } = hashPassword(DEFAULT_PASSWORD);
        newHash = newHashValue;
        newSalt = salt;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      await query(
        `UPDATE users 
         SET password_hash = $1, salt = $2, role = $3 
         WHERE email = $4`,
        [newHash, newSalt, "admin", DEFAULT_EMAIL]
      );
    }

    return needsUpdate;
  } catch (error) {
    console.error("[users] Failed to ensure default user:", error);
    return false;
  }
}

/**
 * Initialize users (ensure default user exists)
 */
async function initializeUsers() {
  if (isDatabaseAvailable()) {
    await ensureDefaultUserInDB();
  } else {
    // Fallback to in-memory storage
    console.warn("[users] Database not available, using in-memory storage");
    if (!userStore.has(DEFAULT_EMAIL)) {
      const { salt, hash } = DEFAULT_PASSWORD_HASH
        ? { salt: "", hash: DEFAULT_PASSWORD_HASH }
        : hashPassword(DEFAULT_PASSWORD);

      userStore.set(DEFAULT_EMAIL, {
        email: DEFAULT_EMAIL,
        passwordHash: hash,
        salt,
        createdAt: Date.now(),
        role: "admin",
      });
    }
  }
}

// Initialize on module load
initializeUsers().catch(() => {
  // Silently fail and retry on next access
});

/**
 * Find user by email
 */
export async function findUser(email: string): Promise<UserRecord | undefined> {
  if (!isDatabaseAvailable()) {
    // Fallback to in-memory storage
    await initializeUsers();
    return userStore.get(normalizeEmail(email));
  }

  try {
    await ensureDefaultUserInDB();
    
    const result = await query<UserRow>(
      "SELECT * FROM users WHERE email = $1",
      [normalizeEmail(email)]
    );

    if (result.length === 0) return undefined;
    return rowToUser(result[0]);
  } catch (error) {
    console.error("[users] Failed to find user:", error);
    return undefined;
  }
}

/**
 * Synchronous version for backwards compatibility (uses cached data)
 * Note: This should be avoided in new code, use findUser instead
 */
export function findUserSync(email: string): UserRecord | undefined {
  if (!email) return undefined;
  // Return from in-memory cache only
  return userStore.get(normalizeEmail(email));
}

/**
 * Create a new user
 */
export async function createUser(email: string, password: string): Promise<UserRecord> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !password.trim()) {
    throw new Error("Email and password are required");
  }

  if (!isDatabaseAvailable()) {
    // Fallback to in-memory storage
    if (userStore.has(normalizedEmail)) {
      throw new Error("Email already registered");
    }

    const { salt, hash } = hashPassword(password);
    const record: UserRecord = {
      email: normalizedEmail,
      passwordHash: hash,
      salt,
      createdAt: Date.now(),
      role: "user",
    };
    userStore.set(normalizedEmail, record);
    return record;
  }

  try {
    // Check if user already exists
    const existing = await query<UserRow>(
      "SELECT * FROM users WHERE email = $1",
      [normalizedEmail]
    );

    if (existing.length > 0) {
      throw new Error("Email already registered");
    }

    const { salt, hash } = hashPassword(password);
    const createdAt = Date.now();

    await query(
      `INSERT INTO users (email, password_hash, salt, created_at, role)
       VALUES ($1, $2, $3, $4, $5)`,
      [normalizedEmail, hash, salt, createdAt.toString(), "user"]
    );

    return {
      email: normalizedEmail,
      passwordHash: hash,
      salt,
      createdAt,
      role: "user",
    };
  } catch (error) {
    if (error instanceof Error && error.message === "Email already registered") {
      throw error;
    }
    console.error("[users] Failed to create user:", error);
    throw new Error("Failed to create user");
  }
}

/**
 * Verify user password
 */
export async function verifyPassword(email: string, password: string): Promise<boolean> {
  if (!email) return false;

  const user = await findUser(email);
  if (!user) return false;

  if (!user.salt) {
    // Legacy env-based hash (unsalted SHA-256)
    const digest = createHash("sha256").update(password).digest();
    const expected = Buffer.from(user.passwordHash, "hex");
    if (digest.length !== expected.length) return false;
    return timingSafeEqual(digest, expected);
  }

  const { hash } = hashPassword(password, user.salt);
  const expected = Buffer.from(user.passwordHash, "hex");
  const given = Buffer.from(hash, "hex");
  if (expected.length !== given.length) return false;
  return timingSafeEqual(given, expected);
}

/**
 * Check if user is admin
 */
export function isAdminUser(email: string): boolean {
  if (!email) return false;
  const normalized = normalizeEmail(email);
  
  // Check in-memory cache first (synchronous)
  const cached = userStore.get(normalized);
  if (cached?.role === "admin") return true;
  
  // Check if it's the default admin email
  return normalized === DEFAULT_EMAIL;
}

/**
 * Check if any non-admin users exist
 */
export async function hasAnyNonAdminUser(): Promise<boolean> {
  if (!isDatabaseAvailable()) {
    // Fallback to in-memory storage
    for (const record of userStore.values()) {
      if (record.role !== "admin") return true;
    }
    return false;
  }

  try {
    const result = await query<{ count: string }>(
      "SELECT COUNT(*) as count FROM users WHERE role != 'admin'"
    );

    const count = parseInt(result[0]?.count ?? "0", 10);
    return count > 0;
  } catch (error) {
    console.error("[users] Failed to check for non-admin users:", error);
    return false;
  }
}

/**
 * List all non-admin user emails
 */
export async function listNonAdminUserEmails(): Promise<string[]> {
  if (!isDatabaseAvailable()) {
    // Fallback to in-memory storage
    const emails: string[] = [];
    for (const record of userStore.values()) {
      if (record.role !== "admin") {
        emails.push(record.email);
      }
    }
    return emails;
  }

  try {
    const result = await query<{ email: string }>(
      "SELECT email FROM users WHERE role != 'admin' ORDER BY email"
    );

    return result.map((row) => row.email);
  } catch (error) {
    console.error("[users] Failed to list non-admin users:", error);
    return [];
  }
}

/**
 * Get total user count (excluding admins)
 */
export async function getTotalUserCount(): Promise<number> {
  if (!isDatabaseAvailable()) {
    // Fallback to in-memory storage
    let count = 0;
    for (const record of userStore.values()) {
      if (record.role !== "admin") {
        count++;
      }
    }
    return count;
  }

  try {
    const result = await query<{ count: string }>(
      "SELECT COUNT(*) as count FROM users WHERE role != 'admin'"
    );

    return parseInt(result[0]?.count ?? "0", 10);
  } catch (error) {
    console.error("[users] Failed to get user count:", error);
    return 0;
  }
}
