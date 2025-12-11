import { NextRequest, NextResponse } from "next/server";

import { getSession, isAdminEmail } from "@/lib/auth";
import {
  listDeviceLabels,
  listDevicePreferences,
  listDevicePreferencesForUser,
  listThresholdsByUser,
  listDeviceLabelsForUser,
  setUserThresholds,
  updateDevicePreferences,
  setUserLabel,
} from "@/lib/device-preferences";
import type { TemperatureThresholds } from "@/types/devices";
import { getAssignedDeviceId } from "@/lib/assignments";

export async function GET() {
  const session = await getSession();
  const labelsAll = listDeviceLabels();
  if (!session) {
    return NextResponse.json({ labels: labelsAll, preferences: {} });
  }
  const isAdmin = isAdminEmail(session.email);
  const preferencesAll = isAdmin ? listDevicePreferences() : listDevicePreferencesForUser(session.email);
  const labelsForUser = listDeviceLabelsForUser(session.email);

  const payload: Record<string, unknown> = {
    labels: (() => {
      if (isAdmin) return labelsAll;
      const assigned = getAssignedDeviceId(session.email);
      const out: Record<string, string> = {};
      if (assigned && labelsForUser[assigned]) out[assigned] = labelsForUser[assigned];
      return out;
    })(),
    preferences: (() => {
      if (isAdmin) return preferencesAll;
      const assigned = getAssignedDeviceId(session.email);
      const out: Record<string, (typeof preferencesAll)[string]> = {};
      if (assigned && preferencesAll[assigned]) out[assigned] = preferencesAll[assigned];
      return out;
    })(),
    isAdmin,
  };

  if (isAdmin) {
    payload.preferencesByUser = listThresholdsByUser();
  }
  return NextResponse.json(payload);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      deviceId?: string;
      label?: string;
      thresholds?: TemperatureThresholds | null;
    };

    if (!body?.deviceId) {
      return NextResponse.json({ error: "deviceId is required" }, { status: 400 });
    }

    // Label updates: per-user for non-admin, global for admin
    if ("label" in body) {
      if (isAdminEmail(session.email)) {
        updateDevicePreferences(body.deviceId, { label: body.label ?? "" });
      } else {
        setUserLabel(body.deviceId, session.email, body.label ?? null);
      }
    }

    // Threshold updates are per-user; block admin from changing thresholds
    if ("thresholds" in body) {
      if (isAdminEmail(session.email)) {
        return NextResponse.json({ error: "Admins cannot change thresholds" }, { status: 403 });
      }
      setUserThresholds(body.deviceId, session.email, body.thresholds ?? null);
    }

    const labelsAll = listDeviceLabels();
    const isAdmin = isAdminEmail(session.email);
    const preferencesAll = isAdmin ? listDevicePreferences() : listDevicePreferencesForUser(session.email);
    const assigned = getAssignedDeviceId(session.email);
    const labelsForUser = listDeviceLabelsForUser(session.email);
    const payload: Record<string, unknown> = {
      labels: (() => {
        if (isAdminEmail(session.email)) return labelsAll;
        const out: Record<string, string> = {};
        if (assigned && labelsForUser[assigned]) out[assigned] = labelsForUser[assigned];
        return out;
      })(),
      preferences: (() => {
        if (isAdmin) return preferencesAll;
        const out: Record<string, (typeof preferencesAll)[string]> = {};
        if (assigned && preferencesAll[assigned]) out[assigned] = preferencesAll[assigned];
        return out;
      })(),
    };
    if (isAdmin) {
      payload.preferencesByUser = listThresholdsByUser();
    }

    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}

