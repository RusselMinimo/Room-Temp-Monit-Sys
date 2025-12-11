# Quick Start Guide

## Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Visit http://localhost:3000
```

## Production Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

## Docker Deployment

```bash
# 1. Copy and configure environment
cp .env.example .env.production
# Edit .env.production with your values

# 2. Build and start
docker-compose up -d

# 3. View logs
docker-compose logs -f

# 4. Stop
docker-compose down
```

## Health Check

```bash
# Check if service is running
curl http://localhost:3000/api/health
```

## Environment Variables

Minimum required for production:
- `NEXT_PUBLIC_APP_URL` - Your domain (e.g., `https://yourdomain.com`)
- `AUTH_EMAIL` - Admin email
- `AUTH_PASSWORD` - Admin password

See `.env.example` for all options.

## More Information

- Full deployment guide: [DEPLOYMENT.md](./DEPLOYMENT.md)
- Pre-deployment checklist: [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)

