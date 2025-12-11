// Standalone seed script - works independently without importing server-only modules
import postgres from "postgres";
import { createHash, randomBytes } from "node:crypto";

/**
 * Seed test users for localhost development
 * Run this script to create test accounts for testing
 */

interface TestUser {
  email: string;
  password: string;
  role?: "admin" | "user";
}

const TEST_USERS: TestUser[] = [
  {
    email: "russelminimo0529@gmail.com",
    password: "russelpass",
    role: "user",
  },
  {
    email: "test@example.com",
    password: "testpass123",
    role: "user",
  },
  {
    email: "admin@test.local",
    password: "admin123",
    role: "admin",
  },
];

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

async function seedUsers() {
  console.log("[seed] Starting user seeding...");

  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    console.warn("[seed] DATABASE_URL not configured.");
    console.warn("[seed] Note: This script requires a database to persist users.");
    console.warn("[seed] Create .env.local with DATABASE_URL and run migrations first.");
    return;
  }

  // Create database connection directly
  const sql = postgres(DATABASE_URL, {
    prepare: false,
  });

  try {
    for (const user of TEST_USERS) {
      try {
        const normalizedEmail = normalizeEmail(user.email);

        // Check if user already exists
        const existing = await sql`
          SELECT email FROM users WHERE email = ${normalizedEmail}
        `;

        if (existing.length > 0) {
          console.log(`[seed] ⏭️  User already exists: ${user.email}`);
          continue;
        }

        // Hash password
        const { salt, hash } = hashPassword(user.password);

        // Create user
        await sql`
          INSERT INTO users (email, password_hash, salt, created_at, role)
          VALUES (${normalizedEmail}, ${hash}, ${salt}, ${Date.now().toString()}, ${user.role || "user"})
        `;

        console.log(`[seed] ✅ Created ${user.role || "user"} user: ${user.email} (password: ${user.password})`);
      } catch (error) {
        if (error instanceof Error) {
          // Check if it's a unique constraint violation
          if (error.message.includes("duplicate key") || error.message.includes("already exists")) {
            console.log(`[seed] ⏭️  User already exists: ${user.email}`);
          } else {
            console.error(`[seed] ❌ Failed to create user ${user.email}:`, error.message);
          }
        } else {
          console.error(`[seed] ❌ Failed to create user ${user.email}:`, error);
        }
      }
    }

    console.log("[seed] User seeding completed!");
    console.log("[seed]");
    console.log("[seed] Test credentials:");
    TEST_USERS.forEach((user) => {
      console.log(`[seed]   - ${user.email} / ${user.password} (${user.role || "user"})`);
    });
  } finally {
    await sql.end();
  }
}

// Run if executed directly
if (require.main === module) {
  seedUsers()
    .then(() => {
      console.log("[seed] Done!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("[seed] Fatal error:", error);
      process.exit(1);
    });
}

export { seedUsers };
