# Deployment Guide

This guide covers deploying the Room Temperature Monitoring System to production.

## Prerequisites

- Node.js 20+ and npm 10+
- Docker and Docker Compose (for containerized deployment)
- Or a Node.js hosting platform (Vercel, Railway, Render, etc.)

## Quick Start with Docker

### 1. Prepare Environment Variables

Copy the example environment file and configure it:

```bash
cp .env.example .env.production
```

Edit `.env.production` with your production values:
- Set `NEXT_PUBLIC_APP_URL` to your production domain
- Configure `AUTH_EMAIL` and `AUTH_PASSWORD` for the admin account
- Set `IOT_API_KEY` to secure your API endpoints
- Configure alert notifications (optional)

### 2. Build and Run with Docker Compose

```bash
# Build and start the container
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the container
docker-compose down
```

The application will be available at `http://localhost:3000`.

### 3. Manual Docker Build

```bash
# Build the image
docker build -t room-temp-monitor .

# Run the container
docker run -d \
  --name room-temp-monitor \
  -p 3000:3000 \
  --env-file .env.production \
  -v $(pwd)/data:/app/data \
  room-temp-monitor
```

## Deployment Options

### Option 1: Vercel (Recommended for Next.js)

1. **Install Vercel CLI** (optional):
   ```bash
   npm i -g vercel
   ```

2. **Deploy**:
   ```bash
   vercel
   ```

3. **Set up Vercel KV (Required for User Accounts)**:
   - Go to your Vercel project dashboard
   - Navigate to **Storage** → **Create Database** → **KV** (Redis)
   - Create a new KV database (free tier available)
   - Vercel will automatically add these environment variables:
     - `KV_REST_API_URL`
     - `KV_REST_API_TOKEN`
   - **Important**: User accounts created via signup will only persist if KV is configured!

4. **Configure Environment Variables** (CRITICAL):
   - Go to your project settings on Vercel → Environment Variables
   - Add **ALL** environment variables from `.env.example`, especially:
     - `AUTH_EMAIL` - Your admin email (e.g., `admin@yourdomain.com`)
     - `AUTH_PASSWORD` - Your admin password (use a strong password!)
     - `NEXT_PUBLIC_APP_URL` - Your Vercel domain (e.g., `https://your-app.vercel.app`)
   - **Important**: Without these variables, you won't be able to log in!
   - After adding variables, redeploy your application

5. **How Storage Works on Vercel**:
   - **With Vercel KV**: User accounts and sessions persist across deployments and cold starts ✅
   - **Without Vercel KV**: 
     - File-based storage (`data/` directory) is **read-only** on Vercel
     - Only the default admin account (from `AUTH_EMAIL`/`AUTH_PASSWORD`) will work
     - User accounts created via signup **won't persist** between deployments or cold starts
     - Sessions **won't persist** across function invocations
   - **Recommendation**: Always set up Vercel KV for production deployments

### Option 2: Railway

1. **Connect your repository** to Railway
2. **Add environment variables** in the Railway dashboard
3. **Deploy** - Railway will auto-detect Next.js and deploy

### Option 3: Render

1. **Create a new Web Service** on Render
2. **Connect your repository**
3. **Build Command**: `npm install && npm run build`
4. **Start Command**: `npm start`
5. **Add environment variables** in the Render dashboard

### Option 4: Traditional VPS (Ubuntu/Debian)

1. **Install Node.js 20+**:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

2. **Clone and setup**:
   ```bash
   git clone <your-repo>
   cd Room-Temp-Monit-Sys
   npm install
   ```

3. **Configure environment**:
   ```bash
   cp .env.example .env.production
   nano .env.production  # Edit with your values
   ```

4. **Build and start**:
   ```bash
   npm run build
   npm start
   ```

5. **Use PM2 for process management**:
   ```bash
   npm install -g pm2
   pm2 start npm --name "room-temp-monitor" -- start
   pm2 save
   pm2 startup  # Follow instructions to enable auto-start
   ```

6. **Setup Nginx reverse proxy** (optional):
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

## Environment Variables

### Required for Production

- `NEXT_PUBLIC_APP_URL` - Your production domain (e.g., `https://yourdomain.com`)
- `AUTH_EMAIL` - Admin email address
- `AUTH_PASSWORD` - Admin password (will be hashed automatically)

### Recommended

- `IOT_API_KEY` - Secure your API endpoints (`/api/ingest`, `/api/readings`)
- `AUTH_SESSION_TTL_SECONDS` - Session timeout (default: 28800 = 8 hours)

### Optional

- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - Enable Google OAuth
- `ALERT_RESEND_API_KEY` / `ALERT_EMAIL_FROM` / `ALERT_EMAIL_TO` - Email alerts
- `ALERT_TWILIO_*` - SMS alerts

See `.env.example` for all available options.

## Data Persistence

The application stores data in the `data/` directory:
- `users.json` - User accounts
- `sessions.json` - Active sessions
- `device-preferences.json` - Device configurations
- `auth-logs.json` - Authentication logs

**Important**: 
- This directory is git-ignored and should be backed up regularly
- For production, consider migrating to a database (PostgreSQL, MongoDB)
- If using Docker, mount the `data/` directory as a volume

## Health Check

The application exposes a health check endpoint:
```
GET /api/health
```

Returns:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "room-temp-monitor"
}
```

Use this for:
- Load balancer health checks
- Monitoring systems
- Docker health checks

## Security Checklist

- [ ] Set strong `AUTH_PASSWORD` for admin account
- [ ] Set `IOT_API_KEY` to secure API endpoints
- [ ] Use HTTPS in production (set `NEXT_PUBLIC_APP_URL` to `https://`)
- [ ] Configure secure cookies (automatic in production with `NODE_ENV=production`)
- [ ] Review and restrict CORS if needed
- [ ] Regularly backup `data/` directory
- [ ] Keep dependencies updated (`npm audit`)
- [ ] Use environment variables, never commit secrets

## Troubleshooting

### Container won't start
- Check Docker logs: `docker-compose logs`
- Verify environment variables are set correctly
- Ensure port 3000 is not already in use

### Data not persisting
- Verify `data/` directory is mounted as a volume in Docker
- Check file permissions (should be writable by the app user)

### API endpoints returning 401
- Verify `IOT_API_KEY` is set and matches what your devices are sending
- Check that devices include the key in query param `?key=...` or header `x-api-key`

### Health check failing
- Ensure the app is running and accessible
- Check that port 3000 is exposed correctly
- Verify no firewall is blocking the port

### Can't login on Vercel
- **Verify environment variables are set**: Go to Vercel Dashboard → Your Project → Settings → Environment Variables
- **Required variables**:
  - `AUTH_EMAIL` must be set (e.g., `admin@yourdomain.com`)
  - `AUTH_PASSWORD` must be set (your admin password)
  - `NEXT_PUBLIC_APP_URL` should be your Vercel domain (e.g., `https://your-app.vercel.app`)
- **After adding/updating variables**: Redeploy your application (Vercel → Deployments → Redeploy)
- **Check variable names**: Ensure they match exactly (case-sensitive)
- **Note**: Only the default admin account (from env vars) will work. User accounts created via signup won't persist on Vercel due to read-only filesystem

## Production Recommendations

1. **Use a Database**: Migrate from JSON files to PostgreSQL or MongoDB for better reliability and scalability
2. **Add Monitoring**: Set up monitoring (e.g., Sentry, LogRocket) for error tracking
3. **Enable Logging**: Configure structured logging for production debugging
4. **Backup Strategy**: Automate backups of the `data/` directory
5. **SSL/TLS**: Always use HTTPS in production (Let's Encrypt, Cloudflare, etc.)
6. **Rate Limiting**: Consider adding rate limiting to API endpoints
7. **CDN**: Use a CDN for static assets (Vercel, Cloudflare, etc.)

## Support

For issues or questions, refer to the main README.md or open an issue in the repository.

