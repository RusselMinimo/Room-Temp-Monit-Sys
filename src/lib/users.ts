import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface UserRecord {
  email: string;
  passwordHash: string;
  salt?: string;
  createdAt: number;
  role?: "admin" | "user";
}

const DATA_DIR = join(process.cwd(), "data");
const USERS_FILE = join(DATA_DIR, "users.json");

const userStore = new Map<string, UserRecord>();
const DEFAULT_EMAIL = (process.env.AUTH_EMAIL ?? "admin@iot.local").trim().toLowerCase();
const DEFAULT_PASSWORD = process.env.AUTH_PASSWORD ?? "iot-room-pass";
const DEFAULT_PASSWORD_HASH = process.env.AUTH_PASSWORD_HASH?.trim();

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function hashPassword(password: string, salt?: string) {
  const nextSalt = salt ?? randomBytes(16).toString("hex");
  const hash = createHash("sha256").update(`${nextSalt}:${password}`).digest("hex");
  return { salt: nextSalt, hash };
}

function loadUsersFromDisk() {
  if (!existsSync(USERS_FILE)) return;
  try {
    const raw = readFileSync(USERS_FILE, "utf8");
    if (!raw.trim()) return;
    const parsed = JSON.parse(raw) as UserRecord[];
    for (const record of parsed) {
      if (record?.email && record?.passwordHash) {
        userStore.set(record.email, record);
      }
    }
  } catch {
    // ignore corrupted file
  }
}

function persistUsersToDisk() {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    const serialized = JSON.stringify(Array.from(userStore.values()), null, 2);
    writeFileSync(USERS_FILE, serialized, "utf8");
  } catch {
    // ignore file system errors for now
  }
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
  } else if (DEFAULT_PASSWORD && !verifyPassword(DEFAULT_EMAIL, DEFAULT_PASSWORD)) {
    const { salt, hash } = hashPassword(DEFAULT_PASSWORD);
    nextRecord.passwordHash = hash;
    nextRecord.salt = salt;
    shouldPersist = true;
  }

  if (shouldPersist) userStore.set(DEFAULT_EMAIL, nextRecord);
  return shouldPersist;
}

loadUsersFromDisk();
if (ensureDefaultUser()) {
  persistUsersToDisk();
}

export function findUser(email: string): UserRecord | undefined {
  return userStore.get(normalizeEmail(email));
}

export function createUser(email: string, password: string): UserRecord {
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
  persistUsersToDisk();
  return record;
}

export function verifyPassword(email: string, password: string): boolean {
  const user = findUser(email);
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
  const normalized = normalizeEmail(email);
  const record = userStore.get(normalized);
  if (record?.role === "admin") return true;
  return normalized === DEFAULT_EMAIL;
}

export function hasAnyNonAdminUser(): boolean {
  // Reload users to stay in sync across workers/processes
  loadUsersFromDisk();
  for (const record of userStore.values()) {
    if (record.role !== "admin") return true;
  }
  return false;
}

export function listNonAdminUserEmails(): string[] {
  // Ensure we have the latest snapshot across workers
  loadUsersFromDisk();
  const emails: string[] = [];
  for (const record of userStore.values()) {
    if (record.role !== "admin") {
      emails.push(record.email);
    }
  }
  return emails;
}

export function getTotalUserCount(): number {
  // Reload users to stay in sync across workers/processes
  loadUsersFromDisk();
  let count = 0;
  for (const record of userStore.values()) {
    if (record.role !== "admin") {
      count++;
    }
  }
  return count;
}


