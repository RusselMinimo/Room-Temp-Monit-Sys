import { NextRequest, NextResponse } from "next/server";
import { addReading, type Reading } from "@/lib/store";

function isAuthorized(request: NextRequest): boolean {
  const requiredKey = process.env.IOT_API_KEY;
  if (!requiredKey) return true; // no key required

  const url = new URL(request.url);
  const keyFromQuery = url.searchParams.get("key");
  const auth = request.headers.get("authorization") || "";
  const keyFromHeader = request.headers.get("x-api-key") || (auth.startsWith("Bearer ") ? auth.slice(7) : "");
  return keyFromQuery === requiredKey || keyFromHeader === requiredKey;
}

function parseNumber(value: string | null): number | undefined {
  if (value == null) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function buildReadingFromSearchParams(url: URL): Reading | null {
  const deviceId = url.searchParams.get("deviceId");
  const temperatureC = parseNumber(url.searchParams.get("temperatureC"));
  const humidityPct = parseNumber(url.searchParams.get("humidityPct"));
  const rssi = parseNumber(url.searchParams.get("rssi"));
  if (!deviceId || typeof temperatureC !== "number") return null;
  return {
    deviceId,
    temperatureC,
    humidityPct,
    rssi,
    ts: new Date().toISOString(),
    isDemo: false,
  };
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const reading = buildReadingFromSearchParams(url);
  if (!reading) return NextResponse.json({ error: "deviceId and temperatureC are required" }, { status: 400 });
  addReading(reading);
  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
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

  // Fallback: allow URL-encoded or querystring-like POSTs from constrained clients
  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("text/plain") || contentType.includes("text/html")) {
    const text = await request.text();
    const url = new URL("http://dummy/?" + text);
    const reading = buildReadingFromSearchParams(url);
    if (!reading) return NextResponse.json({ error: "deviceId and temperatureC are required" }, { status: 400 });
    addReading(reading);
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  // If unknown content type, also accept query params appended to POST URL
  const url = new URL(request.url);
  const reading = buildReadingFromSearchParams(url);
  if (!reading) return NextResponse.json({ error: "Unsupported content-type" }, { status: 415 });
  addReading(reading);
  return NextResponse.json({ ok: true }, { status: 201 });
}


