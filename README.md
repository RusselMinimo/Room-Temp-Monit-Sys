## IoT Room Temperature Monitor

Next.js 14 dashboard that displays real-time readings from Arduino-based sensors.  
The UI falls back to demo data until a real reading is ingested through `/api/ingest`.

## Quick Start

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`. As soon as an authentic reading arrives, "Demo Mode" disappears.

## Deployment

This application is ready for production deployment. See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

**Quick Deploy Options:**
- **Docker**: `docker-compose up -d` (see [DEPLOYMENT.md](./DEPLOYMENT.md))
- **Vercel**: `vercel` (recommended for Next.js)
- **Railway/Render**: Connect repository and deploy

**Pre-deployment Checklist**: See [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)

## Prerequisites

- Node.js >= 18.17
- npm >= 10
- **Neon Postgres Database** (for production) - see [Database Setup](#database-setup)
- Arduino (e.g., Uno/Nano with USB) + DHT22 wired to pin 2 (optional for real sensors)
- USB cable (shows up as `USB-SERIAL CH340 (COMx)` on Windows)

## Install & Run the Web App

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`. As soon as an authentic reading arrives, "Demo Mode" disappears.

## Database Setup

This application uses **Neon Postgres** for persistent data storage:

### Quick Setup

1. **Create Neon Database** on Vercel:
   - Go to Vercel Dashboard → Storage → Create Database
   - Choose **Neon** (Serverless Postgres)
   - Copy the connection string

2. **Configure Environment Variable**:
   Create `.env.local` and add:
   ```bash
   DATABASE_URL=postgresql://user:password@host/database?sslmode=require
   ```

3. **Run Migrations**:
   ```bash
   npm run db:migrate
   ```

4. **Verify Setup**:
   ```bash
   npm run dev
   # Check console - should see no database warnings
   ```

### What Gets Stored in Database

- ✅ **Users & Sessions** - Persistent authentication
- ✅ **IoT Readings** - Time-series sensor data with full history
- ✅ **Device Preferences** - Labels, thresholds, and assignments
- ✅ **Auth Logs** - Login/logout history for audit trail

### Development Without Database

The app includes **fallback to in-memory storage** if `DATABASE_URL` is not set:
- ⚠️ Data is lost on server restart
- ⚠️ Limited to 500 readings per device
- ⚠️ Not recommended for production

**For detailed setup instructions**, see [DATABASE_SETUP.md](./DATABASE_SETUP.md)

## Authentication & Sign Up


- Override via `.env.local`:

  | Variable                  | Description                                                   |
  |---------------------------|---------------------------------------------------------------|
  | `AUTH_EMAIL`              | Seed admin email                                              |
  | `AUTH_PASSWORD`           | Plain-text password (hashed with salted SHA-256 in-memory)    |
  | `AUTH_PASSWORD_HASH`      | Optional hex-encoded SHA-256 digest (legacy fallback)         |
  | `AUTH_SESSION_TTL_SECONDS`| Session lifetime (defaults to 8 hours)                        |

- Users can self-register at `/signup`. Accounts are hashed with random salts and stored in the database (or in-memory if no database is configured).
- Login is enforced on dashboard routes (`/admin-dashboard` for admins, `/user-dashboard` for regular users). Successful logins issue HTTP-only cookies.
- Authentication events (signups, logins, logouts, failures) are logged to the database. Visit `/admin` while signed in as the admin user (email from `AUTH_EMAIL`) to review authentication logs.
- Session tokens persist across serverless restarts when using Postgres.

## Sending Readings Manually

```bash
curl "http://localhost:3000/api/ingest" \
  -X POST \
  -H "content-type: application/json" \
  -d '{"deviceId":"LivingRoom","temperatureC":24.7,"humidityPct":52}'
```

If `IOT_API_KEY` is set inside `.env.local`, add `?key=...` to the URL or send an `x-api-key` header.

## Wi-Fi Connectivity

Any Wi-Fi capable microcontroller (ESP32, ESP8266, Pico W, etc.) can POST to `/api/ingest`. The firmware loop simply needs to:

1. Connect to the same SSID as the dashboard (or ensure outbound HTTPS to your deployed host).
2. Collect sensor values (e.g., DHT22, BME280) and optional RSSI.
3. Send a JSON payload:

```ts
await fetch("https://YOUR_HOST/api/ingest?key=YOUR_API_KEY", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    deviceId: "Room-Temperature",
    temperatureC: 24.6,
    humidityPct: 48,
    rssi: -52,
  }),
});
```

The dashboard polls `/api/readings` every second and also listens to `/api/stream`, so each Wi-Fi reading appears almost instantly on the chart.

## Alerts & Notifications

- Configure per-device low/high thresholds on the dashboard (Devices section).
- When a reading crosses a threshold, a colored banner appears on the dashboard (rose for high, blue for low) until the value returns to the safe range.
- Server-side alerting remembers the last state per device, so notifications fire only on crossings (entering high/low from normal).
- Optional email (Resend API) and/or SMS (Twilio API) delivery is supported for one pre-configured contact.

| Variable | Description |
|----------|-------------|
| `ALERT_RESEND_API_KEY` | Resend API key for sending alert emails |
| `ALERT_EMAIL_FROM` | Verified sender address for Resend (e.g., `alerts@yourdomain.com`) |
| `ALERT_EMAIL_TO` | Recipient email that receives alerts |
| `ALERT_TWILIO_ACCOUNT_SID` | Twilio Account SID for SMS delivery |
| `ALERT_TWILIO_AUTH_TOKEN` | Twilio auth token |
| `ALERT_SMS_FROM` | Twilio phone number (E.164) that originates alerts |
| `ALERT_SMS_TO` | Destination phone number (E.164) |

Provide either the email trio or the SMS quartet (or both). If no variables are set, alerts stay on the dashboard only.

## Bridge Your Existing Arduino Sketch

The Arduino IDE sketch you shared prints lines like:

```
Humidity: 48.6 %   Temperature: 25.1 C / 77.2 F
```

The app now includes a serial bridge that parses those lines and POSTs them to `/api/ingest`.

### 1. Flash the Arduino

Upload your sketch (DHT connected to pin 2, 9600 baud). Nothing else needs to change on the device.

### 2. Configure the Bridge

| Variable          | Default                     | Notes                                   |
|-------------------|-----------------------------|-----------------------------------------|
| `SERIAL_PORT`     | `COM6`                      | Windows COM port from Device Manager    |
| `SERIAL_BAUDRATE` | `9600`                      | Matches `Serial.begin` in the sketch    |
| `IOT_DEVICE_ID`   | `Room-Temperature`          | Label shown in the dashboard            |
| `IOT_INGEST_URL`  | `http://localhost:3000/api/ingest` | Point to dev/prod ingest endpoint |
| `IOT_API_KEY`     | _(optional)_                | Forwarded via `x-api-key` header        |
| `IOT_TEMP_OFFSET_C` | `0`                       | Apply °C calibration (e.g., `-5`)       |
| `IOT_HUMIDITY_OFFSET_PCT` | `0`                 | Apply humidity calibration (e.g., `-10`) |
| `BRIDGE_VERBOSE`  | `1`                         | Set to `1` to echo every serial line    |

> The bridge reads both `.env.local` and `.env`, so you can keep these values alongside the Next.js env vars without exporting them manually.

### 3. Run the Bridge

```bash
SERIAL_PORT=COM6 \
SERIAL_BAUDRATE=9600 \
IOT_DEVICE_ID=LivingRoom \
npm run bridge:serial
```

Keep this process running alongside `npm run dev`. Each time the Arduino prints a reading, the bridge:

1. Parses humidity and Celsius values.
2. Applies any offsets (`IOT_TEMP_OFFSET_C`, `IOT_HUMIDITY_OFFSET_PCT`).
3. Sends a JSON payload to `/api/ingest`.
4. Logs success (`Sent reading -> temp: 25.1C, humidity: 48%`).

Stop with `Ctrl+C`; the serial port is closed gracefully.

### Troubleshooting

- **Still in demo mode?** Confirm at least one successful HTTP 201/200 from the bridge.
- **Wrong COM port?** Check `Device Manager -> Ports (COM & LPT)`.
- **API key mismatch?** Ensure the same `IOT_API_KEY` is in both `.env.local` and the bridge env.
- **Need calibration?** Set `IOT_TEMP_OFFSET_C=-3.5` (for example) to lower the reported temperature, and `IOT_HUMIDITY_OFFSET_PCT` likewise for humidity.
- **Different print format?** Adjust `parseSensorLine` inside `scripts/serial-bridge.ts`.

With the bridge running, the website will show your live DHT22 readings instead of simulated data.
"# Room-Temp-Monit-Sys" 
"# Room-Temp-Monit-Sys" 
