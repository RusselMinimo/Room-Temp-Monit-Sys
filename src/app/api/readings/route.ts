import { NextResponse, NextRequest } from "next/server";
import { addReading, listLatestReadings, type Reading } from "@/lib/store";
import {
  listDeviceLabels,
  listDevicePreferences,
  listDevicePreferencesForUser,
  listThresholdsByUser,
  listDeviceLabelsForUser,
} from "@/lib/device-preferences";
import { listActiveAlerts } from "@/lib/alerts";
import { getSession, isAdminEmail } from "@/lib/auth";
import { getUserAuthStatuses } from "@/lib/auth-logs";
import { hasAnyNonAdminUser, listNonAdminUserEmails } from "@/lib/users";
import { getAssignedDeviceId, listAssignments } from "@/lib/assignments";

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
  const asParam = searchParams.get("as")?.trim().toLowerCase() || undefined;

  // Determine session/admin first so we can decide on demo behavior
  const session = await getSession();
  const isAdmin = session ? isAdminEmail(session.email) : false;
  const impersonatedEmail = isAdmin && asParam ? asParam : undefined;

  const existingReadings = listLatestReadings();
  const hasRealDevices = existingReadings.some((reading) => reading.isDemo !== true);

  // Seed demo data when requested and no real devices are present.
  // Allow this for admins as well so they can monitor demo when hardware is not connected.
  if (requestDemo && !hasRealDevices) {
    generateDemoReadings();
  }

  let readings = listLatestReadings();
  // Enforce room scoping for non-admin users
  if (impersonatedEmail) {
    const assigned = await getAssignedDeviceId(impersonatedEmail);
    const demoOnly = !hasRealDevices;
    if (assigned) {
      readings = readings.filter((r) => r.deviceId === assigned);
    } else if (!demoOnly) {
      // If real devices exist but user has no assignment, show all real device readings
      readings = readings.filter((r) => r.isDemo !== true);
    } // if demoOnly and unassigned, allow showing demo data
  } else if (session && !isAdmin) {
    const assigned = await getAssignedDeviceId(session.email);
    const demoOnly = !hasRealDevices;
    if (assigned) {
      readings = readings.filter((r) => r.deviceId === assigned);
    } else if (!demoOnly) {
      // If real devices exist but user has no assignment, show all real device readings
      readings = readings.filter((r) => r.isDemo !== true);
    } // if demoOnly and unassigned, allow showing demo data
  } else if (isAdmin) {
    // For admins, hide demo data only when real devices exist.
    // If there are no real devices, keep demo so admins can monitor.
    if (hasRealDevices) {
      readings = readings.filter((r) => r.isDemo !== true);
    }
  }

  const realReadings = readings.filter((reading) => reading.isDemo !== true);
  const demoReadings = readings.filter((reading) => reading.isDemo === true);
  const isDemoMode = realReadings.length === 0 && demoReadings.length > 0;

  const scopedPreferences = (() => {
    if (impersonatedEmail) return listDevicePreferencesForUser(impersonatedEmail);
    if (!session) return {};
    return isAdmin ? listDevicePreferences() : listDevicePreferencesForUser(session.email);
  })();
  // For admins, always provide full device preferences (with all labelsByUser) for admin cards
  // even when impersonating a user, so admin can see all users' labels
  const allPreferences = isAdmin ? listDevicePreferences() : undefined;
  // Always provide all thresholds to admins, regardless of active sessions
  const allThresholds = isAdmin ? listThresholdsByUser() : undefined;
  const hasNonAdminUsers = isAdmin ? await hasAnyNonAdminUser() : false;
  const registeredEmails = isAdmin ? await listNonAdminUserEmails() : undefined;
  const filteredThresholds = (() => {
    if (!isAdmin || !allThresholds) return undefined;
    const allowed = new Set((registeredEmails ?? []).map((e) => e.trim().toLowerCase()));
    const out: Record<string, Record<string, unknown>> = {};
    for (const [deviceId, byUser] of Object.entries(allThresholds)) {
      const filtered: Record<string, unknown> = {};
      for (const [email, thresholds] of Object.entries(byUser)) {
        const normalized = email.trim().toLowerCase();
        if (allowed.has(normalized)) filtered[normalized] = thresholds;
      }
      if (Object.keys(filtered).length > 0) out[deviceId] = filtered;
    }
    return out;
  })();
  const assignedUsersByDevice = await (async () => {
    if (!isAdmin) return undefined;
    const assignments = await listAssignments();
    const inverted: Record<string, string> = {};
    for (const [email, deviceId] of Object.entries(assignments)) {
      if (!deviceId) continue;
      if (inverted[deviceId]) continue;
      inverted[deviceId] = email;
    }
    return inverted;
  })();
  const alertsAll = listActiveAlerts();
  const alerts = (() => {
    if (impersonatedEmail) return alertsAll.filter((a) => !a.userEmail || a.userEmail === impersonatedEmail);
    if (isAdmin) return alertsAll;
    return alertsAll.filter((a) => !a.userEmail || a.userEmail === session?.email);
  })();
  const userAuthStatuses = isAdmin ? await getUserAuthStatuses() : undefined;

  const assignedDeviceId = impersonatedEmail
    ? await getAssignedDeviceId(impersonatedEmail)
    : session && !isAdmin
      ? await getAssignedDeviceId(session.email)
      : undefined;

  return NextResponse.json({
    assignedDeviceId,
    readings,
    realDeviceCount: realReadings.length,
    demoDeviceCount: demoReadings.length,
    isDemoMode,
    // Always provide labels and per-user thresholds to admins
    labels: (() => {
      if (impersonatedEmail) return listDeviceLabelsForUser(impersonatedEmail);
      if (isAdmin) return listDeviceLabels();
      if (session) return listDeviceLabelsForUser(session.email);
      return {};
    })(),
    preferences: scopedPreferences,
    allPreferences, // Full device preferences with all labelsByUser for admin cards
    preferencesByUser: filteredThresholds,
    assignedUsersByDevice,
    isAdmin,
    hasNonAdminUsers,
    alerts,
    userAuthStatuses,
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


