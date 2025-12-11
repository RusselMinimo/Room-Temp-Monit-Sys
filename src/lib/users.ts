import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { storage } from "@/lib/storage";

export interface UserRecord {
  email: string;
  passwordHash: string;
  salt?: string;
  createdAt: number;
  role?: "admin" | "user";
}

const STORAGE_KEY = "users";
const userStore = new Map<string, UserRecord>();
const DEFAULT_EMAIL = (process.env.AUTH_EMAIL?.trim() || "admin@iot.local").toLowerCase();
const DEFAULT_PASSWORD = process.env.AUTH_PASSWORD || "iot-room-pass";
const DEFAULT_PASSWORD_HASH = process.env.AUTH_PASSWORD_HASH?.trim();

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

async function loadUsersFromStorage() {
  const users = await storage.read<UserRecord[]>(STORAGE_KEY);
  if (!users || !Array.isArray(users)) return;
  for (const record of users) {
    if (record?.email && record?.passwordHash) {
      userStore.set(record.email, record);
    }
  }
}

async function persistUsersToStorage() {
  const users = Array.from(userStore.values());
  await storage.write(STORAGE_KEY, users);
}

function ensureDefaultUser(): boolean {
  const existing = userStore.get(DEFAULT_EMAIL);

  if (!existing) {
    if (DEFAULT_PASSWORD_HASH) {
      userStore.set(DEFAULT_EMAIL, {
        email: DEFAULT_EMAIL,
        passwordHash: DEFAULT_PASSWORD_HASH,
        salt: "",
        createdAt: Date.now(),
        role: "admin",
      });
      return true;
    }
    const { salt, hash } = hashPassword(DEFAULT_PASSWORD);
    userStore.set(DEFAULT_EMAIL, {
      email: DEFAULT_EMAIL,
      passwordHash: hash,
      salt,
      createdAt: Date.now(),
      role: "admin",
    });
    return true;
  }

  let shouldPersist = false;
  const nextRecord: UserRecord = {
    ...existing,
    email: DEFAULT_EMAIL,
    role: "admin",
    createdAt: existing.createdAt ?? Date.now(),
  };

  if (existing.role !== "admin") {
    shouldPersist = true;
  }

  if (DEFAULT_PASSWORD_HASH) {
    const needsHashUpdate = existing.passwordHash !== DEFAULT_PASSWORD_HASH || Boolean(existing.salt);
    if (needsHashUpdate) {
      nextRecord.passwordHash = DEFAULT_PASSWORD_HASH;
      nextRecord.salt = "";
      shouldPersist = true;
    }
  } else if (DEFAULT_PASSWORD) {
    // Verify password synchronously by checking hash directly
    const { hash } = hashPassword(DEFAULT_PASSWORD, existing.salt);
    const expected = Buffer.from(existing.passwordHash, "hex");
    const given = Buffer.from(hash, "hex");
    const passwordMatches = expected.length === given.length && 
      timingSafeEqual(expected, given);
    
    if (!passwordMatches) {
      const { salt, hash: newHash } = hashPassword(DEFAULT_PASSWORD);
      nextRecord.passwordHash = newHash;
      nextRecord.salt = salt;
      shouldPersist = true;
    }
  }

  if (shouldPersist) userStore.set(DEFAULT_EMAIL, nextRecord);
  return shouldPersist;
}

// Initialize users: load from storage (if available) and ensure default user exists
// This runs asynchronously in the background
loadUsersFromStorage()
  .then(() => {
    ensureDefaultUser();
    persistUsersToStorage();
  })
  .catch(() => {
    // If loading fails, ensure default user still exists in memory
    ensureDefaultUser();
  });

export async function findUser(email: string): Promise<UserRecord | undefined> {
  // Ensure we have latest data from storage (handles serverless cold starts)
  await loadUsersFromStorage();
  // Ensure default user exists before looking up
  ensureDefaultUser();
  if (!email) return undefined;
  return userStore.get(normalizeEmail(email));
}

// Synchronous version for backwards compatibility (uses cached data)
export function findUserSync(email: string): UserRecord | undefined {
  ensureDefaultUser();
  if (!email) return undefined;
  return userStore.get(normalizeEmail(email));
}

export async function createUser(email: string, password: string): Promise<UserRecord> {
  // Load latest users from storage first
  await loadUsersFromStorage();
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !password.trim()) {
    throw new Error("Email and password are required");
  }
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
  await persistUsersToStorage();
  return record;
}

export async function verifyPassword(email: string, password: string): Promise<boolean> {
  // Load latest users from storage and ensure default user exists
  await loadUsersFromStorage();
  ensureDefaultUser();
  if (!email) return false;
  const user = userStore.get(normalizeEmail(email));
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

export function isAdminUser(email: string): boolean {
  if (!email) return false;
  const normalized = normalizeEmail(email);
  // Use sync version for backwards compatibility
  const record = findUserSync(normalized);
  if (record?.role === "admin") return true;
  return normalized === DEFAULT_EMAIL;
}

export async function hasAnyNonAdminUser(): Promise<boolean> {
  // Reload users to stay in sync across workers/processes
  await loadUsersFromStorage();
  for (const record of userStore.values()) {
    if (record.role !== "admin") return true;
  }
  return false;
}

export async function listNonAdminUserEmails(): Promise<string[]> {
  // Ensure we have the latest snapshot across workers
  await loadUsersFromStorage();
  const emails: string[] = [];
  for (const record of userStore.values()) {
    if (record.role !== "admin") {
      emails.push(record.email);
    }
  }
  return emails;
}

export async function getTotalUserCount(): Promise<number> {
  // Reload users to stay in sync across workers/processes
  await loadUsersFromStorage();
  let count = 0;
  for (const record of userStore.values()) {
    if (record.role !== "admin") {
      count++;
    }
  }
  return count;
}


