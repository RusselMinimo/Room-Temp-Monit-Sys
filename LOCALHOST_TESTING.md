# Localhost Testing Guide

This guide will help you set up and test the Room Temperature Monitoring System on localhost.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Database (Optional but Recommended)

For persistent data storage:

1. Create `.env.local` in the project root:
```bash
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
```

2. Run migrations:
```bash
npm run db:migrate
```

**Note:** If you don't set up a database, the app will use in-memory storage. Data will be lost on restart, but you can still test all features.

### 3. Seed Test Users

Create test accounts for easy testing:

```bash
npm run db:seed
```

This creates the following test accounts:

| Email | Password | Role |
|-------|----------|------|
| `russelminimo0529@gmail.com` | `russelpass` | user |
| `test@example.com` | `testpass123` | user |
| `admin@test.local` | `admin123` | admin |

### 4. Start Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` and log in with any of the test accounts above.

## Alternative: Use Default Admin Account

If you don't want to run the seed script, you can use the default admin account. Add to `.env.local`:

```bash
AUTH_EMAIL=admin@iot.local
AUTH_PASSWORD=your-password-here
```

The default admin account is automatically created on first access.

## Testing Features

### User Features (Regular User)
- View assigned room temperature readings
- Set custom temperature thresholds
- Receive alerts when thresholds are exceeded
- View alert history

### Admin Features (Admin User)
- View all rooms and devices
- Monitor all users' authentication logs
- Manage user accounts
- View system-wide statistics
- Configure device labels and settings

## Creating Additional Test Users

You can create additional test users by:

1. **Via Signup Page**: Visit `http://localhost:3000/signup` and create a new account
2. **Via Seed Script**: Edit `src/lib/migrations/seed.ts` and add users to the `TEST_USERS` array, then run `npm run db:seed`

## Resetting Test Data

To start fresh:

1. If using database: Drop and recreate tables (or manually delete data)
2. Run migrations: `npm run db:migrate`
3. Run seed: `npm run db:seed`

## Troubleshooting

### "Invalid email or password" Error

- Make sure you ran `npm run db:seed` to create test users
- Or ensure `AUTH_EMAIL` and `AUTH_PASSWORD` are set in `.env.local` for the default admin
- Check database connection if using database mode

### Users Not Persisting

- If using database: Verify `DATABASE_URL` is set correctly in `.env.local`
- Check console for database connection errors
- Run `npm run db:migrate` to ensure tables exist

### Can't Access Admin Features

- Log in with an admin account (`admin@test.local` / `admin123` from seed script)
- Or ensure your email is in the admin list (check `src/lib/auth.ts` for `isAdminEmail` function)

