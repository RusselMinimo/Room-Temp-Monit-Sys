import { NextResponse, NextRequest } from "next/server";
import { addReading, listLatestReadings, type Reading } from "@/lib/store";

function isAuthorized(request: NextRequest): boolean {
  const requiredKey = process.env.IOT_API_KEY;
  if (!requiredKey) return true; // no key required
  const { searchParams } = new URL(request.url);
  const keyFromQuery = searchParams.get("key");
  const auth = request.headers.get("authorization") || "";
  const keyFromHeader = request.headers.get("x-api-key") || (auth.startsWith("Bearer ") ? auth.slice(7) : "");
  return keyFromQuery === requiredKey || keyFromHeader === requiredKey;
}

function generateDemoReadings() {
  const deviceId = "Room-Temperature";
  const temperatureC = 22 + Math.random() * 4; // 22-26 C
  const humidityPct = 45 + Math.random() * 15; // 45-60%
  const reading: Reading = {
    deviceId,
    ts: new Date().toISOString(),
    temperatureC: Number(temperatureC.toFixed(1)),
    humidityPct: Number(humidityPct.toFixed(0)),
    isDemo: true,
  };
  addReading(reading);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const requestDemo = searchParams.get("demo") === "1";

  const existingReadings = listLatestReadings();
  const hasRealDevices = existingReadings.some((reading) => reading.isDemo !== true);

  if (requestDemo && !hasRealDevices) {
    generateDemoReadings();
  }

  const readings = listLatestReadings();
  const realReadings = readings.filter((reading) => reading.isDemo !== true);
  const demoReadings = readings.filter((reading) => reading.isDemo === true);
  const isDemoMode = realReadings.length === 0 && demoReadings.length > 0;

  return NextResponse.json({
    readings,
    realDeviceCount: realReadings.length,
    demoDeviceCount: demoReadings.length,
    isDemoMode,
  });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await request.json()) as Partial<Reading>;
    if (!body || typeof body.deviceId !== "string" || typeof body.temperatureC !== "number") {
      return NextResponse.json({ error: "deviceId and temperatureC are required" }, { status: 400 });
    }
    const reading: Reading = {
      deviceId: body.deviceId,
      temperatureC: body.temperatureC,
      humidityPct: typeof body.humidityPct === "number" ? body.humidityPct : undefined,
      rssi: typeof body.rssi === "number" ? body.rssi : undefined,
      ts: new Date().toISOString(),
      isDemo: false,
    };
    addReading(reading);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}


