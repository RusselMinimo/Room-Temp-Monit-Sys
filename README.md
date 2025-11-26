## IoT Room Temperature Monitor

Next.js 14 dashboard that displays real-time readings from Arduino-based sensors.  
The UI falls back to demo data until a real reading is ingested through `/api/ingest`.

## Prerequisites

- Node.js >= 18.17
- npm >= 10
- Arduino (e.g., Uno/Nano with USB) + DHT22 wired to pin 2
- USB cable (shows up as `USB-SERIAL CH340 (COMx)` on Windows)

## Install & Run the Web App

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`. As soon as an authentic reading arrives, "Demo Mode" disappears.

## Sending Readings Manually

```bash
curl "http://localhost:3000/api/ingest" \
  -X POST \
  -H "content-type: application/json" \
  -d '{"deviceId":"LivingRoom","temperatureC":24.7,"humidityPct":52}'
```

If `IOT_API_KEY` is set inside `.env.local`, add `?key=...` to the URL or send an `x-api-key` header.

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
