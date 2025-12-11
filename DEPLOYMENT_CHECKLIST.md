# Pre-Deployment Checklist

Use this checklist before deploying to production.

## Environment Setup

- [ ] Copy `.env.example` to `.env.production`
- [ ] Set `NEXT_PUBLIC_APP_URL` to your production domain (e.g., `https://yourdomain.com`)
- [ ] Change default `AUTH_EMAIL` and `AUTH_PASSWORD` to secure values
- [ ] Set `IOT_API_KEY` to secure your API endpoints
- [ ] Configure `AUTH_SESSION_TTL_SECONDS` if needed (default: 8 hours)
- [ ] If using Google OAuth: Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- [ ] If using email alerts: Configure Resend API credentials
- [ ] If using SMS alerts: Configure Twilio credentials

## Security

- [ ] All environment variables are set and secure
- [ ] `IOT_API_KEY` is set (recommended for production)
- [ ] Admin password is strong and changed from default
- [ ] HTTPS is configured (if not using a platform that handles it)
- [ ] `.env.production` is not committed to git
- [ ] Data directory (`/data`) is backed up or will be persisted

## Build & Test

- [ ] Run `npm install` to ensure dependencies are up to date
- [ ] Run `npm run build` successfully
- [ ] Test locally with `npm start`
- [ ] Verify health check endpoint: `curl http://localhost:3000/api/health`
- [ ] Test authentication flow (login/logout)
- [ ] Test device ingestion endpoint (if applicable)

## Docker (if using)

- [ ] Dockerfile builds successfully: `docker build -t room-temp-monitor .`
- [ ] Container starts: `docker run -p 3000:3000 --env-file .env.production room-temp-monitor`
- [ ] Health check works in container
- [ ] Data volume is properly mounted
- [ ] `docker-compose up -d` works correctly

## Data Persistence

- [ ] Backup strategy for `data/` directory is in place
- [ ] If using Docker: Volume mount is configured
- [ ] If using cloud platform: Consider migrating to database

## Monitoring

- [ ] Health check endpoint is accessible
- [ ] Logging is configured (if applicable)
- [ ] Error tracking is set up (optional but recommended)

## Documentation

- [ ] Team members know where to find deployment docs
- [ ] Environment variables are documented
- [ ] Backup/restore procedures are documented

## Post-Deployment

- [ ] Verify application is accessible at production URL
- [ ] Test login with admin credentials
- [ ] Verify API endpoints are working
- [ ] Check that data is persisting correctly
- [ ] Monitor logs for any errors
- [ ] Test device connectivity (if applicable)

## Rollback Plan

- [ ] Previous version is tagged/backed up
- [ ] Rollback procedure is documented
- [ ] Data backup is available if needed

