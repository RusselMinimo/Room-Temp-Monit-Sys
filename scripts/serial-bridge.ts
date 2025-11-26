import process from "node:process";
import path from "node:path";
import { existsSync } from "node:fs";
import { SerialPort, ReadlineParser } from "serialport";
import { config as loadEnv } from "dotenv";

function loadEnvironment() {
  loadEnv();
  const localEnvPath = path.resolve(process.cwd(), ".env.local");
  if (existsSync(localEnvPath)) {
    loadEnv({ path: localEnvPath, override: true });
  }
}

loadEnvironment();

interface BridgeConfig {
  portPath: string;
  baudRate: number;
  serverUrl: string;
  deviceId: string;
  apiKey?: string;
  logVerbose: boolean;
  temperatureOffsetC: number;
  humidityOffsetPct: number;
}

interface SensorReading {
  temperatureC: number;
  humidityPct?: number;
}

function getConfig(): BridgeConfig {
  const portPath = process.env.SERIAL_PORT || "COM6";
  const baudRate = Number(process.env.SERIAL_BAUDRATE || "9600");
  const serverUrl = process.env.IOT_INGEST_URL || "http://localhost:3000/api/ingest";
  const deviceId = process.env.IOT_DEVICE_ID || "Room-Temperature";
  const apiKey = process.env.IOT_API_KEY?.trim() || undefined;
  const logVerbose = process.env.BRIDGE_VERBOSE === "1";
  const temperatureOffsetC = Number(process.env.IOT_TEMP_OFFSET_C || "0");
  const humidityOffsetPct = Number(process.env.IOT_HUMIDITY_OFFSET_PCT || "0");

  if (!Number.isFinite(baudRate) || baudRate <= 0) {
    throw new Error(`Invalid SERIAL_BAUDRATE value: ${process.env.SERIAL_BAUDRATE}`);
  }
  if (!Number.isFinite(temperatureOffsetC)) {
    throw new Error(`Invalid IOT_TEMP_OFFSET_C value: ${process.env.IOT_TEMP_OFFSET_C}`);
  }
  if (!Number.isFinite(humidityOffsetPct)) {
    throw new Error(`Invalid IOT_HUMIDITY_OFFSET_PCT value: ${process.env.IOT_HUMIDITY_OFFSET_PCT}`);
  }

  return {
    portPath,
    baudRate,
    serverUrl,
    deviceId,
    apiKey,
    logVerbose,
    temperatureOffsetC,
    humidityOffsetPct,
  };
}

function parseSensorLine(line: string): SensorReading | null {
  const humidityMatch = line.match(/Humidity:\s*(-?\d+(?:\.\d+)?)/i);
  const temperatureMatch = line.match(/Temperature:\s*(-?\d+(?:\.\d+)?)/i);

  if (!temperatureMatch) return null;
  const temperatureC = Number(temperatureMatch[1]);
  if (!Number.isFinite(temperatureC)) return null;

  const humidityPct = humidityMatch ? Number(humidityMatch[1]) : undefined;
  const reading: SensorReading = { temperatureC };
  if (humidityPct !== undefined && Number.isFinite(humidityPct)) reading.humidityPct = humidityPct;
  return reading;
}

function applyCalibration(reading: SensorReading, config: BridgeConfig): SensorReading {
  const temperatureC = Number((reading.temperatureC + config.temperatureOffsetC).toFixed(2));
  const humidityPct =
    typeof reading.humidityPct === "number"
      ? Number((reading.humidityPct + config.humidityOffsetPct).toFixed(1))
      : undefined;
  return { temperatureC, humidityPct };
}

async function postReading(reading: SensorReading, config: BridgeConfig) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (config.apiKey) headers["x-api-key"] = config.apiKey;

  const response = await fetch(config.serverUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      deviceId: config.deviceId,
      temperatureC: reading.temperatureC,
      humidityPct: reading.humidityPct,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Ingest failed with ${response.status}: ${body}`);
  }
}

async function handleLine(line: string, config: BridgeConfig) {
  const trimmed = line.trim();
  if (!trimmed) return;
  if (config.logVerbose) {
    console.log(`[serial] ${trimmed}`);
  }

  if (trimmed.includes("Failed to read")) {
    console.warn("[bridge] Sensor error reported by Arduino");
    return;
  }

  const reading = parseSensorLine(trimmed);
  if (!reading) return;

  try {
    const calibrated = applyCalibration(reading, config);
    await postReading(calibrated, config);
    console.log(
      `[bridge] Sent reading -> temp: ${calibrated.temperatureC.toFixed(1)}°C` +
        (typeof calibrated.humidityPct === "number" ? `, humidity: ${calibrated.humidityPct.toFixed(0)}%` : "")
    );
  } catch (error) {
    console.error("[bridge] Failed to send reading", error);
  }
}

function startBridge(config: BridgeConfig) {
  console.log(`[bridge] Connecting to ${config.portPath} @ ${config.baudRate} baud`);
  console.log(`[bridge] Forwarding to ${config.serverUrl} as device "${config.deviceId}"`);

  const port = new SerialPort({
    path: config.portPath,
    baudRate: config.baudRate,
  });

  const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));

  parser.on("data", (line: string) => {
    void handleLine(line, config);
  });

  port.on("open", () => {
    console.log("[bridge] Serial connection established");
  });

  port.on("error", (error: Error) => {
    console.error("[bridge] Serial error", error);
  });

  process.on("SIGINT", () => {
    console.log("\n[bridge] Shutting down");
    parser.removeAllListeners();
    port.close();
    process.exit(0);
  });
}

function main() {
  const config = getConfig();
  startBridge(config);
}

main();


