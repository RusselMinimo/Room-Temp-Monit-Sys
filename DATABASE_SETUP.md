# Database Setup Guide

This guide will help you set up Neon Postgres for your Room Temperature Monitoring System.

## 1. Create Neon Database

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to **Storage** → **Create Database**
3. Click **Create** next to **Neon** (Serverless Postgres)
4. Follow the prompts to create your database
5. Copy the connection string provided

## 2. Configure Environment Variables

### Local Development

1. Create a `.env.local` file in your project root:

```bash
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
```

Replace with your actual Neon connection string.

### Production (Vercel)

Vercel will automatically set `DATABASE_URL` when you connect the Neon database to your project.

Alternatively, manually add it:
1. Go to your Vercel project settings
2. Navigate to **Environment Variables**
3. Add `DATABASE_URL` with your Neon connection string

## 3. Run Database Migrations

After configuring the database connection, run migrations to create tables:

```bash
npm run db:migrate
```

This will create all necessary tables:
- `users` - User accounts
- `sessions` - Authentication sessions
- `readings` - IoT sensor data (time-series)
- `device_preferences` - Device labels and thresholds
- `user_device_labels` - User-specific device labels
- `user_device_thresholds` - User-specific temperature alerts
- `device_assignments` - Room assignments for users
- `auth_logs` - Authentication logs
- `key_value_storage` - Legacy key-value storage

## 4. Verify Database Connection

Start your development server:

```bash
npm run dev
```

Check the console logs. You should see:
- ✅ No database warnings
- ✅ Successful database operations

If you see warnings like `[db] Database not configured`, verify your `DATABASE_URL` is set correctly.

## 5. Database Fallback Behavior

The application includes fallback mechanisms:

### With Database (Production)
- ✅ Persistent data storage
- ✅ Survives serverless restarts
- ✅ Historical IoT readings
- ✅ Scalable and queryable

### Without Database (Development Fallback)
- ⚠️ In-memory storage only
- ⚠️ Data lost on server restart
- ⚠️ Limited to 500 readings per device
- ⚠️ Not suitable for production

## 6. Database Schema

### Key Tables

#### `readings` - IoT Sensor Data
```sql
CREATE TABLE readings (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(255) NOT NULL,
  temperature_c DECIMAL(5, 2) NOT NULL,
  humidity_pct DECIMAL(5, 2),
  rssi INTEGER,
  is_demo BOOLEAN DEFAULT FALSE,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `users` - User Accounts
```sql
CREATE TABLE users (
  email VARCHAR(255) PRIMARY KEY,
  password_hash VARCHAR(255) NOT NULL,
  salt VARCHAR(255),
  created_at BIGINT NOT NULL,
  role VARCHAR(50) DEFAULT 'user'
);
```

#### `sessions` - Authentication Sessions
```sql
CREATE TABLE sessions (
  token VARCHAR(255) PRIMARY KEY,
  email VARCHAR(255) NOT NULL REFERENCES users(email),
  issued_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL
);
```

## 7. Maintenance

### Cleanup Old Readings

To prevent database bloat, periodically clean old readings:

```typescript
import { cleanupOldReadings } from '@/lib/store';

// Remove readings older than 30 days
await cleanupOldReadings(30);
```

Consider setting up a cron job or scheduled task to run this weekly.

### Monitor Database Size

Check your Neon dashboard for:
- Database size
- Query performance
- Connection count

## 8. Troubleshooting

### "Database not configured" warnings

**Cause**: `DATABASE_URL` environment variable is missing

**Solution**: 
1. Verify `.env.local` exists and contains `DATABASE_URL`
2. Restart your development server
3. Check for typos in the connection string

### "Connection failed" errors

**Cause**: Invalid connection string or network issues

**Solution**:
1. Verify the connection string is correct
2. Ensure `?sslmode=require` is at the end
3. Check your internet connection
4. Verify Neon database is active (not paused)

### Migration fails

**Cause**: Database already has tables or syntax errors

**Solution**:
1. Check migration logs for specific errors
2. Verify you're using PostgreSQL-compatible syntax
3. Try running migrations again (they're idempotent)

### Data not persisting

**Cause**: Falling back to in-memory storage

**Solution**:
1. Verify database connection is working
2. Check console logs for database errors
3. Ensure migrations have run successfully

## 9. Switching from File Storage

If you were previously using file-based storage, your data is NOT automatically migrated. You'll need to:

1. **Users**: Export from `data/users.json`, then manually create accounts via signup
2. **Readings**: Old readings in memory are not preserved (start fresh)
3. **Preferences**: Export from `data/device-preferences.json`, then set via UI

Consider this a fresh start with proper database backing!

## 10. Next Steps

Once your database is set up:
1. ✅ Create your first user account via `/signup`
2. ✅ Start sending IoT readings to `/api/ingest`
3. ✅ Configure device labels and alerts via settings
4. ✅ Monitor your dashboard for real-time updates

For more information, see the main [README.md](./README.md).

