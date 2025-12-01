import "server-only";

import type { Reading } from "@/lib/store";
import type { ActiveAlert, AlertVariant } from "@/types/alerts";
import type { TemperatureThresholds } from "@/types/devices";
import { getAllUserThresholds, getDevicePreferences } from "@/lib/device-preferences";
import { sendAlertNotifications } from "@/lib/notifier";

type AlertMode = AlertVariant | "ok";

// key = `${deviceId}|${email}`
const activeAlerts = new Map<string, ActiveAlert>();
const lastModes = new Map<string, AlertMode>();

function evaluateMode(temperatureC: number, thresholds?: TemperatureThresholds): AlertMode {
  if (!thresholds) return "ok";
  if (typeof thresholds.highC === "number" && temperatureC > thresholds.highC) return "high";
  if (typeof thresholds.lowC === "number" && temperatureC < thresholds.lowC) return "low";
  return "ok";
}

function keyFor(deviceId: string, email: string) {
  return `${deviceId}|${email}`;
}

function clearDeviceForAllUsers(deviceId: string) {
  for (const k of Array.from(activeAlerts.keys())) {
    if (k.startsWith(`${deviceId}|`)) activeAlerts.delete(k);
  }
  for (const k of Array.from(lastModes.keys())) {
    if (k.startsWith(`${deviceId}|`)) lastModes.delete(k);
  }
}

export function handleReadingForAlerts(reading: Reading) {
  if (reading.isDemo) return;

  const preference = getDevicePreferences(reading.deviceId);
  const thresholdsByUser = getAllUserThresholds(reading.deviceId);

  if (!thresholdsByUser || Object.keys(thresholdsByUser).length === 0) {
    // Fallback to legacy device-level thresholds if present
    const legacy = preference?.thresholds;
    if (!legacy) {
      clearDeviceForAllUsers(reading.deviceId);
      return;
    }
    const k = keyFor(reading.deviceId, "__legacy__");
    const mode = evaluateMode(reading.temperatureC, legacy);
    const prev = lastModes.get(k) ?? "ok";
    if (mode === "ok") {
      if (prev !== "ok") {
        activeAlerts.delete(k);
        lastModes.set(k, "ok");
      } else {
        lastModes.set(k, "ok");
      }
      return;
    }
    const thresholdC = mode === "high" ? legacy.highC : legacy.lowC;
    if (typeof thresholdC !== "number") return;
    const existing = activeAlerts.get(k);
    const alert: ActiveAlert = {
      deviceId: reading.deviceId,
      variant: mode,
      thresholdC,
      temperatureC: reading.temperatureC,
      triggeredAt: existing?.triggeredAt ?? reading.ts,
      roomLabel: preference?.label,
    };
    activeAlerts.set(k, alert);
    lastModes.set(k, mode);
    if (mode !== prev) {
      sendAlertNotifications(alert).catch((error) => {
        console.error("[alerts] notification failed", error);
      });
    }
    return;
  }

  for (const [email, thresholds] of Object.entries(thresholdsByUser)) {
    const k = keyFor(reading.deviceId, email);
    const mode = evaluateMode(reading.temperatureC, thresholds);
    const prev = lastModes.get(k) ?? "ok";

    if (mode === "ok") {
      if (prev !== "ok") {
        activeAlerts.delete(k);
        lastModes.set(k, "ok");
      } else {
        lastModes.set(k, "ok");
      }
      continue;
    }

    const thresholdC = mode === "high" ? thresholds.highC : thresholds.lowC;
    if (typeof thresholdC !== "number") continue;

    const existing = activeAlerts.get(k);
    const alert: ActiveAlert = {
      deviceId: reading.deviceId,
      variant: mode,
      thresholdC,
      temperatureC: reading.temperatureC,
      triggeredAt: existing?.triggeredAt ?? reading.ts,
      roomLabel: preference?.label,
      userEmail: email,
    };

    activeAlerts.set(k, alert);
    lastModes.set(k, mode);

    if (mode !== prev) {
      sendAlertNotifications(alert).catch((error) => {
        console.error("[alerts] notification failed", error);
      });
    }
  }
}

export function listActiveAlerts(): ActiveAlert[] {
  return Array.from(activeAlerts.values()).map((alert) => ({ ...alert }));
}



