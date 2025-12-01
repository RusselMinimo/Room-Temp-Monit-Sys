'use client'

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Reading } from "@/lib/store";
import type { DevicePreferences, TemperatureThresholds } from "@/types/devices";
import type { ActiveAlert } from "@/types/alerts";
import { ConnectionStatus } from "./connection-status";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle, Droplets, Thermometer, Timer, WifiOff } from "lucide-react";
import { TemperatureChart, type TemperatureSample } from "./temperature-chart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface UserAuthStatus {
  email: string;
  isOnline: boolean;
  lastEvent: "login_success" | "login_failure" | "logout" | "signup";
  lastEventTime: string;
}

interface ApiResponse {
  readings: Reading[];
  realDeviceCount: number;
  demoDeviceCount: number;
  isDemoMode: boolean;
  labels?: Record<string, string>;
  preferences?: Record<string, DevicePreferences>;
  allPreferences?: Record<string, DevicePreferences>; // Full device preferences with all labelsByUser for admin cards
  alerts?: ActiveAlert[];
  isAdmin?: boolean;
  preferencesByUser?: Record<string, Record<string, TemperatureThresholds>>;
  assignedUsersByDevice?: Record<string, string>;
  hasNonAdminUsers?: boolean;
  userAuthStatuses?: UserAuthStatus[];
}

const MAX_HISTORY_POINTS = 60;
const OFFLINE_THRESHOLD_MS = 20_000; // mark as offline if no packets for 20s

export function LiveReadings() {
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);
  const [isRealtime, setIsRealtime] = useState<boolean>(false);
  const [historyByDevice, setHistoryByDevice] = useState<Record<string, TemperatureSample[]>>({});
  const [devicePreferences, setDevicePreferences] = useState<Record<string, DevicePreferences>>({});
  const [allDevicePreferences, setAllDevicePreferences] = useState<Record<string, DevicePreferences>>({}); // Full preferences with all labelsByUser for admin cards
  const [activeAlerts, setActiveAlerts] = useState<ActiveAlert[]>([]);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [preferencesByUser, setPreferencesByUser] = useState<Record<string, Record<string, TemperatureThresholds>>>({});
  const [assignedUsersByDevice, setAssignedUsersByDevice] = useState<Record<string, string>>({});
  const [userAuthStatuses, setUserAuthStatuses] = useState<UserAuthStatus[]>([]);

  // Avoid hydration mismatch by only rendering after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  const appendHistory = useCallback((reading: Reading) => {
    setHistoryByDevice((prev) => {
      const current = prev[reading.deviceId] ?? [];
      const lastEntry = current[current.length - 1];
      if (lastEntry?.ts === reading.ts) return prev;
      const next = [...current, { ts: reading.ts, temperatureC: reading.temperatureC }];
      const trimmed = next.slice(-MAX_HISTORY_POINTS);
      return { ...prev, [reading.deviceId]: trimmed };
    });
  }, []);

  useEffect(function startPolling() {
    let cancelled = false;

    async function fetchOnce() {
      try {
        const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
        const asParam = params.get("as");
        const url = asParam ? `/api/readings?demo=1&as=${encodeURIComponent(asParam)}` : "/api/readings?demo=1";
        const res = await fetch(url, { cache: "no-store", credentials: "include" });
        if (!res.ok) throw new Error("Request failed");
        const data = (await res.json()) as ApiResponse;
        if (!cancelled) {
          setReadings(data.readings);
          const nextPreferences =
            data.preferences && Object.keys(data.preferences).length > 0
              ? data.preferences
              : derivePreferencesFromLabels(data.labels ?? {});
          setDevicePreferences(nextPreferences);
          // For admins, store full device preferences with all labelsByUser for admin cards
          if (data.allPreferences) {
            setAllDevicePreferences(data.allPreferences);
          } else if (data.isAdmin) {
            // Fallback: if allPreferences not provided but user is admin, use preferences
            setAllDevicePreferences(nextPreferences);
          }
          setActiveAlerts(data.alerts ?? []);
          setIsAdmin(Boolean(data.isAdmin));
          setPreferencesByUser(data.preferencesByUser ?? {});
          setAssignedUsersByDevice(data.assignedUsersByDevice ?? {});
          setUserAuthStatuses(data.userAuthStatuses ?? []);
          // server sends hasNonAdminUsers but UI no longer uses it directly
          // no-op: server filters to registered users only
        }
        data.readings.forEach(appendHistory);
        setHasError(false);
      } catch {
        if (!cancelled) setHasError(true);
      } finally {
        setIsLoading(false);
      }
    }

    fetchOnce();

    let es: EventSource | undefined;
    try {
      es = new EventSource("/api/stream");
      es.onmessage = (evt) => {
        const reading = JSON.parse(evt.data) as Reading;
        setReadings((prev) => {
          const index = prev.findIndex((r) => r.deviceId === reading.deviceId);
          if (index === -1) return [...prev, reading];
          const copy = prev.slice();
          copy[index] = reading;
          return copy;
        });
        appendHistory(reading);
        if (reading.isDemo !== true) setIsRealtime(true);
      };
      es.onerror = () => {
        setIsRealtime(false);
      };
    } catch {
      // ignore
    }

    const timer = window.setInterval(fetchOnce, 1000);
    return function cleanup() {
      cancelled = true;
      if (timer) window.clearInterval(timer);
      if (es) es.close();
    };
  }, [appendHistory]);

  const sortedReadings = useMemo(
    () =>
      readings
        .slice()
        .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()),
    [readings]
  );
  const derivedAlerts = useMemo(
    () => deriveActiveAlertsFromReadings(readings, devicePreferences),
    [readings, devicePreferences]
  );
  const bannerAlerts = activeAlerts.length > 0 ? activeAlerts : derivedAlerts;
  const [nowMs, setNowMs] = useState(0);
  useEffect(() => {
    // Set initial time after mount to avoid hydration mismatch
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (nowMs !== 0) {
      setNowMs(Date.now());
    }
  }, [readings, nowMs]);

  const handlePreferenceSave = useCallback(async (deviceId: string, draft: DeviceDraft) => {
    const payload: {
      deviceId: string;
      label: string;
      thresholds?: TemperatureThresholds | null;
    } = {
      deviceId,
      label: draft.label.trim(),
    };

    const lowValue = parseNumber(draft.lowC);
    const highValue = parseNumber(draft.highC);
    payload.thresholds =
      lowValue === undefined && highValue === undefined
        ? null
        : {
            lowC: lowValue,
            highC: highValue,
          };

    try {
      const res = await fetch("/api/device-labels", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as {
        preferences?: Record<string, DevicePreferences>;
        labels?: Record<string, string>;
      };
      if (data.preferences) {
        setDevicePreferences(data.preferences);
        // For admins, also update allDevicePreferences since POST returns full preferences
        if (isAdmin) {
          setAllDevicePreferences(data.preferences);
        }
      } else if (data.labels) {
        const derived = derivePreferencesFromLabels(data.labels);
        setDevicePreferences(derived);
        if (isAdmin) {
          setAllDevicePreferences(derived);
        }
      }
      return true;
    } catch {
      // ignore for now
    }
    return false;
  }, [isAdmin]);

  const realReadings = useMemo(() => readings.filter((reading) => reading.isDemo !== true), [readings]);
  const demoReadings = useMemo(() => readings.filter((reading) => reading.isDemo === true), [readings]);
  const totalRealDeviceCount = realReadings.length;
  const onlineRealDeviceCount = realReadings.filter((reading) => isReadingOnline(reading, nowMs)).length;
  const demoDeviceCount = demoReadings.length;
  const latestReal = selectLatestReading(realReadings);
  const latestDemo = selectLatestReading(demoReadings);
  const primaryReading = useMemo(() => {
    // For both admin and regular users, use the latest real reading, then demo, then any
    return latestReal ?? latestDemo ?? selectLatestReading(readings);
  }, [latestReal, latestDemo, readings]);
  
  // Check if there's a user status warning (user is offline/logged out)
  const userStatusWarning = useMemo(() => {
    if (!primaryReading || primaryReading.isDemo === true) return null;
    const currentAs = normalizeEmail(searchParams?.get("as") ?? undefined);
    const assignedUserEmail = assignedUsersByDevice?.[primaryReading.deviceId];
    const userEmailToCheck = currentAs || assignedUserEmail;
    if (!userEmailToCheck) return null;
    
    const userStatus = userAuthStatuses?.find((s) => s.email.toLowerCase() === userEmailToCheck.toLowerCase());
    const isUserOnline = userStatus?.isOnline ?? false;
    
    if (!isUserOnline) {
      return {
        email: userEmailToCheck,
        isViewing: Boolean(currentAs),
        lastEventTime: userStatus?.lastEventTime,
      };
    }
    return null;
  }, [primaryReading, searchParams, assignedUsersByDevice, userAuthStatuses]);

  // Prevent hydration mismatch by rendering placeholder during SSR
  if (!mounted) {
    return <div className="text-sm text-muted-foreground">Loading readings…</div>;
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading readings…</div>;
  }

  if (hasError) {
    return <div className="text-sm text-destructive">Failed to load readings. Retrying…</div>;
  }

  const lastUpdateForStatus = latestReal?.ts ?? primaryReading?.ts;
  const connectionLabel = isRealtime && onlineRealDeviceCount > 0 ? "Realtime via SSE" : "Polling every 1s";
  const historyForPrimary = primaryReading ? historyByDevice[primaryReading.deviceId] ?? [] : [];
  const primaryPreference = primaryReading ? devicePreferences[primaryReading.deviceId] : undefined;
  
  return (
    <div className="flex flex-col gap-4">
      <ConnectionStatus
        onlineRealDeviceCount={onlineRealDeviceCount}
        totalRealDeviceCount={totalRealDeviceCount}
        demoDeviceCount={demoDeviceCount}
        lastUpdate={lastUpdateForStatus}
        isAdmin={isAdmin}
      />
      {userStatusWarning && <UserStatusWarning warning={userStatusWarning} />}
      {bannerAlerts.length > 0 && <AlertBanners alerts={bannerAlerts} readings={readings} />}

      {isAdmin && totalRealDeviceCount === 0 && demoDeviceCount === 0 ? (
        <AdminEmptyState />
      ) : isAdmin && totalRealDeviceCount > 0 && !primaryReading ? (
        <div className="mx-auto w-full max-w-xl rounded-lg border border-border bg-background/60 px-4 py-3 text-sm text-muted-foreground shadow-sm">
          Select a device below to view details.
        </div>
      ) : primaryReading ? (
        <>
          <ReadingHero
            reading={primaryReading}
            isDemo={primaryReading.isDemo === true}
            history={historyForPrimary}
            preference={primaryPreference}
            nowMs={nowMs}
            userAuthStatuses={userAuthStatuses}
            assignedUsersByDevice={assignedUsersByDevice}
            searchParams={searchParams}
          />
          <div className="text-center text-xs text-muted-foreground">{connectionLabel}</div>
          {sortedReadings.length > 0 && (
            <DeviceGrid
              readings={sortedReadings}
              preferences={devicePreferences}
              allPreferences={allDevicePreferences}
              histories={historyByDevice}
              onSavePreferences={handlePreferenceSave}
              nowMs={nowMs}
              isAdmin={isAdmin}
              preferencesByUser={preferencesByUser}
              assignedUsersByDevice={assignedUsersByDevice}
              userAuthStatuses={userAuthStatuses}
              alerts={bannerAlerts}
              searchParams={searchParams}
            />
          )}
        </>
      ) : sortedReadings.length > 0 ? (
        // For non-admin users, show DeviceGrid even without primaryReading
        <DeviceGrid
          readings={sortedReadings}
          preferences={devicePreferences}
          allPreferences={allDevicePreferences}
          histories={historyByDevice}
          onSavePreferences={handlePreferenceSave}
          nowMs={nowMs}
          isAdmin={isAdmin}
          preferencesByUser={preferencesByUser}
          assignedUsersByDevice={assignedUsersByDevice}
          userAuthStatuses={userAuthStatuses}
          alerts={bannerAlerts}
          searchParams={searchParams}
        />
      ) : (
        // Empty state for non-admin users with no readings
        <div className="mx-auto w-full max-w-md flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-muted-foreground/40 bg-muted/30 px-8 py-12 text-center shadow-sm">
          <WifiOff className="h-10 w-10 text-muted-foreground" />
          <p className="text-base font-medium">No devices available</p>
          <p className="text-sm text-muted-foreground">Your assigned device will appear here once it&apos;s registered and connected.</p>
        </div>
      )}
    </div>
  );
}

function selectLatestReading(readings: Reading[]): Reading | undefined {
  return readings.reduce<Reading | undefined>((latest, current) => {
    if (!latest) return current;
    return new Date(current.ts) > new Date(latest.ts) ? current : latest;
  }, undefined);
}

interface ReadingHeroProps {
  reading: Reading;
  isDemo: boolean;
  history: TemperatureSample[];
  preference?: DevicePreferences;
  nowMs: number;
  userAuthStatuses?: UserAuthStatus[];
  assignedUsersByDevice?: Record<string, string>;
  searchParams: ReturnType<typeof useSearchParams> | null;
}

function ReadingHero({ reading, isDemo, history, preference, nowMs, userAuthStatuses, assignedUsersByDevice, searchParams }: ReadingHeroProps) {
  const humidityValue = typeof reading.humidityPct === "number" ? reading.humidityPct : undefined;
  const rssiValue = typeof reading.rssi === "number" ? `${reading.rssi} dBm` : undefined;
  const deviceStatus = getDeviceStatus(reading, nowMs);
  const thresholds = preference?.thresholds;
  const thresholdState = getThresholdState(reading.temperatureC, thresholds);

  // Determine which user's status to show:
  // 1. If viewing as a specific user (via ?as= param), use that user's status
  // 2. Otherwise, if there's an assigned user for the device, use that user's status
  // 3. Otherwise, use device status
  const currentAs = normalizeEmail(searchParams?.get("as") ?? undefined);
  const assignedUserEmail = assignedUsersByDevice?.[reading.deviceId];
  
  // Priority: viewing user > assigned user
  const userEmailToCheck = currentAs || assignedUserEmail;
  const userStatus = userEmailToCheck
    ? userAuthStatuses?.find((s) => s.email.toLowerCase() === userEmailToCheck.toLowerCase())
    : undefined;
  
  // We're "viewing" if we're viewing as a specific user (via ?as= param)
  const isViewing = Boolean(currentAs);
  
  // For demo devices or when no user tracking is available, use default device status
  // For real devices with user tracking, prioritize user status over device status
  let status = deviceStatus;
  
  if (!isDemo && userEmailToCheck) {
    // If we have a user to check but no status found, treat as offline
    // (user exists but hasn't logged in or status not available)
    const isUserOnline = userStatus?.isOnline ?? false;
    
    // Determine status label based on user's actual status
    let statusLabel: string;
    if (isUserOnline) {
      // User is online - show "Viewing" if currently viewing as this user, otherwise "Online"
      statusLabel = isViewing ? "Viewing" : "Online";
    } else {
      // User is offline - show "Logged out"
      statusLabel = "Logged out";
    }
    
    // Combine with device status if device is also offline
    if (!deviceStatus.isOnline) {
      statusLabel = `${statusLabel} · Device offline`;
    }
    
    status = {
      // Device must be online AND user must be online for overall "online" status
      // If user is offline, overall status is offline regardless of device
      isOnline: deviceStatus.isOnline && isUserOnline,
      label: statusLabel,
    };
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <div className="overflow-hidden rounded-2xl border border-border bg-card/80 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-4 border-b border-border/60 bg-muted/40 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Room</p>
            <p className="text-lg font-semibold">{preference?.label ?? "Room label not set"}</p>
            {thresholdState.variant === "high" && (
              <p className="text-sm font-medium text-rose-600">⚠️ Warning: Temp is too high</p>
            )}
            {thresholdState.variant === "low" && (
              <p className="text-sm font-medium text-sky-600">⚠️ Warning: Temp is too low</p>
            )}
            <p className="text-xs text-muted-foreground">Device · {reading.deviceId}</p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
                status.isOnline ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
              }`}
            >
              {status.isOnline ? <CheckCircle className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
              {status.label}
            </span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                isDemo ? "bg-yellow-100 text-yellow-900" : "bg-emerald-100 text-emerald-800"
              }`}
            >
              {isDemo ? "Demo Data" : "Live Data"}
            </span>
          </div>
        </div>

        <div className="grid gap-4 px-6 py-6 sm:grid-cols-2">
          <div className="rounded-xl border border-border/60 bg-background/80 p-5 shadow-inner">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Thermometer className="h-4 w-4" />
              Temperature
            </div>
            <div
              className={`mt-4 text-5xl font-semibold tracking-tight ${
                thresholdState.variant === "high"
                  ? "text-rose-600"
                  : thresholdState.variant === "low"
                    ? "text-sky-600"
                    : ""
              }`}
            >
              {reading.temperatureC.toFixed(1)}
              <span className="ml-1 text-lg text-muted-foreground">°C</span>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-background/80 p-5 shadow-inner">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Droplets className="h-4 w-4" />
              Humidity
            </div>
            <div className="mt-4 text-5xl font-semibold tracking-tight">
              {typeof humidityValue === "number" ? humidityValue.toFixed(0) : "—"}
              <span className="ml-1 text-lg text-muted-foreground">
                {typeof humidityValue === "number" ? "% RH" : ""}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-background/80 p-5 shadow-inner sm:col-span-2">
            <div className="flex items-center justify-between gap-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <span>Temperature thresholds</span>
              <span>{thresholds ? formatThresholdRange(thresholds) : "Not configured"}</span>
            </div>
            <p
              className={`mt-3 text-sm font-medium ${
                thresholdState.variant === "ok" ? "text-muted-foreground" : "text-amber-700"
              }`}
            >
              {thresholdState.message}
            </p>
          </div>

          {rssiValue && (
            <div className="rounded-xl border border-border/60 bg-background/80 p-5 shadow-inner sm:col-span-2">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Signal Strength</div>
              <div className="mt-3 text-2xl font-semibold">{rssiValue}</div>
            </div>
          )}
        </div>
      </div>
      <TemperatureChart data={history} />
    </div>
  );
}

function UserStatusWarning({ warning }: { warning: { email: string; isViewing: boolean; lastEventTime?: string } }) {
  return (
    <div
      className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="flex items-center gap-2 font-semibold mb-1">
            <span>User Status Warning</span>
          </div>
          <p className="text-sm mb-1">
            {warning.isViewing
              ? `The user ${warning.email} is currently logged out. You are viewing their dashboard in read-only mode.`
              : `The assigned user ${warning.email} is currently logged out. Data is still available for viewing.`}
          </p>
          {warning.lastEventTime && (
            <p className="text-xs text-amber-700">
              Last logged out {formatRelativeTime(warning.lastEventTime)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function AlertBanners({ alerts, readings }: { alerts: ActiveAlert[]; readings: Reading[] }) {
  if (alerts.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {alerts.map((alert) => {
        const isHigh = alert.variant === "high";
        const tone = isHigh ? "border-rose-200 bg-rose-50 text-rose-900" : "border-sky-200 bg-sky-50 text-sky-900";
        const Icon = isHigh ? AlertTriangle : Thermometer;
        
        // Get the latest reading for this device to show current temperature
        const currentReading = readings.find((r) => r.deviceId === alert.deviceId);
        const currentTemp = currentReading?.temperatureC ?? alert.temperatureC;
        
        return (
          <div
            key={alert.deviceId}
            className={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${tone}`}
            aria-live="polite"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 font-semibold mb-2">
                  <Icon className="h-4 w-4" />
                  <span>{alert.roomLabel ?? alert.deviceId}</span>
                </div>
                <p className="text-sm mb-1">
                  {isHigh
                    ? `Temperature is above the ${alert.thresholdC.toFixed(1)}°C limit.`
                    : `Temperature is below the ${alert.thresholdC.toFixed(1)}°C limit.`}
                </p>
                <p className="text-xs text-muted-foreground">{`Triggered ${formatTime(alert.triggeredAt)}`}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="text-right">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">
                    Current Temperature
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold tabular-nums">{currentTemp.toFixed(1)}</span>
                    <span className="text-lg text-muted-foreground">°C</span>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-background/80 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide border border-current/20">
                  {isHigh ? "HIGH TEMP" : "LOW TEMP"}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "—";
  
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSeconds < 60) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "yesterday";
  return `${diffDays}d ago`;
}

interface DeviceGridProps {
  readings: Reading[];
  preferences: Record<string, DevicePreferences>;
  allPreferences?: Record<string, DevicePreferences>; // Full device preferences with all labelsByUser for admin cards
  histories: Record<string, TemperatureSample[]>;
  nowMs: number;
  onSavePreferences: (deviceId: string, draft: DeviceDraft) => Promise<boolean>;
  isAdmin: boolean;
  preferencesByUser?: Record<string, Record<string, TemperatureThresholds>>;
  assignedUsersByDevice?: Record<string, string>;
  userAuthStatuses?: UserAuthStatus[];
  alerts?: ActiveAlert[];
  searchParams: ReturnType<typeof useSearchParams> | null;
}

interface DeviceDraft {
  label: string;
  lowC: string;
  highC: string;
}

function DeviceGrid({
  readings,
  preferences,
  allPreferences,
  histories,
  nowMs,
  onSavePreferences,
  isAdmin,
  preferencesByUser,
  assignedUsersByDevice,
  userAuthStatuses,
  alerts,
  searchParams,
}: DeviceGridProps) {
  const [draftOverrides, setDraftOverrides] = useState<Record<string, DeviceDraft>>({});
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const filteredReadings = useMemo(() => {
    // Show all readings for admins so they can monitor every registered device,
    // regardless of assignment or per-user thresholds.
    return readings;
  }, [readings]);

  return (
    <section className="mt-6 space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Devices</p>
        <p className="text-sm text-muted-foreground">Label rooms, tune thresholds, and review health in one place.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {filteredReadings.map((reading) => {
          const status = getDeviceStatus(reading, nowMs);
          const preference = preferences[reading.deviceId];
          const draft = draftOverrides[reading.deviceId] ?? createDraftFromPreference(preference);
          const history = histories[reading.deviceId] ?? [];
          const thresholds = preference?.thresholds;
          const thresholdState = getThresholdState(reading.temperatureC, thresholds);
          const errorMessage = errors[reading.deviceId];
          const deviceAlert = alerts?.find((a) => a.deviceId === reading.deviceId);

          return (
            <>
            {/* Only show device card for non-admin users */}
            {!isAdmin && (
            <article
              key={reading.deviceId}
              className={`flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/70 p-4 shadow-sm`}
            >
              {deviceAlert && (
                <div
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    deviceAlert.variant === "high"
                      ? "border-rose-200 bg-rose-50 text-rose-900"
                      : "border-sky-200 bg-sky-50 text-sky-900"
                  }`}
                  aria-live="polite"
                >
                  <div className="flex items-center gap-2 font-semibold">
                    {deviceAlert.variant === "high" ? (
                      <AlertTriangle className="h-4 w-4" />
                    ) : (
                      <Thermometer className="h-4 w-4" />
                    )}
                    <span className="text-xs uppercase tracking-wide">
                      {deviceAlert.variant === "high" ? "High temp alert" : "Low temp alert"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs">
                    {deviceAlert.variant === "high"
                      ? `Temperature ${deviceAlert.temperatureC.toFixed(1)}°C is above the ${deviceAlert.thresholdC.toFixed(1)}°C limit.`
                      : `Temperature ${deviceAlert.temperatureC.toFixed(1)}°C is below the ${deviceAlert.thresholdC.toFixed(1)}°C limit.`}
                  </p>
                </div>
              )}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Room label</p>
                  <p className="text-base font-semibold">{preference?.label ?? "Add a descriptive name"}</p>
                  {thresholdState.variant === "high" && (
                    <p className="text-sm font-medium text-rose-600">⚠️ Warning: Temp is too high</p>
                  )}
                  {thresholdState.variant === "low" && (
                    <p className="text-sm font-medium text-sky-600">⚠️ Warning: Temp is too low</p>
                  )}
                  <p className="text-xs text-muted-foreground">Device ID · {reading.deviceId}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
                      status.isOnline ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {status.isOnline ? <CheckCircle className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                    {status.label}
                  </span>
                </div>
              </div>

              <form
                className="space-y-2 rounded-xl border border-border/60 bg-background/70 p-3"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const canEdit = true;
                  if (!canEdit) return;
                    const lowValue = parseNumber(draft.lowC);
                    const highValue = parseNumber(draft.highC);
                    if (lowValue !== undefined && highValue !== undefined && lowValue >= highValue) {
                      setErrors((prev) => ({ ...prev, [reading.deviceId]: "High threshold must be greater than low threshold." }));
                      return;
                    }

                    setErrors((prev) => ({ ...prev, [reading.deviceId]: undefined }));
                    const didSave = await onSavePreferences(reading.deviceId, draft);
                    if (didSave) {
                      setDraftOverrides((prev) => {
                        const next = { ...prev };
                        delete next[reading.deviceId];
                        return next;
                      });
                    }
                  }}
                >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    value={draft.label}
                    placeholder="e.g., Server Room"
                    onChange={(event) =>
                      setDraftOverrides((prev) => ({
                        ...prev,
                        [reading.deviceId]: { ...draft, label: event.target.value },
                      }))
                    }
                    className="h-9"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    variant="outline"
                  >
                    Save
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Low threshold (°C)</p>
                    <Input
                      type="number"
                      step="0.5"
                      value={draft.lowC}
                      placeholder="18"
                      onChange={(event) =>
                        setDraftOverrides((prev) => ({
                          ...prev,
                          [reading.deviceId]: { ...draft, lowC: event.target.value },
                        }))
                      }
                      className="mt-1 h-9"
                    />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">High threshold (°C)</p>
                    <Input
                      type="number"
                      step="0.5"
                      value={draft.highC}
                      placeholder="27"
                      onChange={(event) =>
                        setDraftOverrides((prev) => ({
                          ...prev,
                          [reading.deviceId]: { ...draft, highC: event.target.value },
                        }))
                      }
                      className="mt-1 h-9"
                    />
                  </div>
                </div>
                {errorMessage && <p className="text-xs text-destructive">{errorMessage}</p>}
                {!thresholds && !draft.lowC && !draft.highC && (
                  <p className="text-xs text-muted-foreground">Set thresholds to enable alerting later.</p>
                )}
              </form>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-border/60 bg-background/90 p-3 shadow-inner">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current temp</p>
                  <p
                    className={`text-2xl font-semibold ${
                      thresholdState.variant === "high"
                        ? "text-rose-600"
                        : thresholdState.variant === "low"
                          ? "text-sky-600"
                          : ""
                    }`}
                  >
                    {reading.temperatureC.toFixed(1)}
                    <span className="ml-1 text-sm text-muted-foreground">°C</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{thresholdState.message}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/90 p-3 shadow-inner">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Last update</p>
                  <p className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
                    <Timer className="h-3.5 w-3.5" />
                    {formatTime(reading.ts)}
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-background/90 p-3 shadow-inner">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Thresholds</p>
                  <p className="text-sm font-medium">{formatThresholdRange(thresholds)}</p>
                  <p className="text-xs text-muted-foreground">Low · High</p>
                </div>
              </div>

              {history.length > 1 && (
                <div className="rounded-xl border border-dashed border-border/60 bg-background/70 p-3">
                  <MiniSparkline data={history} />
                </div>
              )}

            </article>
            )}

            {isAdmin && (
              <AdminUserRooms
                reading={reading}
                preference={allPreferences?.[reading.deviceId] ?? preference}
                preferencesByUser={preferencesByUser}
                preferredEmail={assignedUsersByDevice?.[reading.deviceId]}
                userAuthStatuses={userAuthStatuses}
                alerts={alerts}
                searchParams={searchParams}
              />
            )}
            </>
          );
        })}
      </div>
    </section>
  );
}

function MiniSparkline({ data }: { data: TemperatureSample[] }) {
  const lineData = data.slice(-20);
  if (lineData.length < 2) {
    return <p className="text-xs text-muted-foreground">Collecting history…</p>;
  }
  const temps = lineData.map((point) => point.temperatureC);
  const min = Math.min(...temps);
  const max = Math.max(...temps);
  const range = max - min || 1;
  const coords = lineData.map((point, index) => {
    const x = (index / (lineData.length - 1)) * 100;
    const y = 100 - ((point.temperatureC - min) / range) * 100;
    return `${x},${y}`;
  });

  return (
    <svg viewBox="0 0 100 40" className="h-20 w-full">
      <polyline
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        points={coords.join(" ")}
      />
    </svg>
  );
}

function AdminUserRooms({
  reading,
  preference,
  preferencesByUser,
  preferredEmail,
  userAuthStatuses,
  alerts,
  searchParams,
}: {
  reading: Reading;
  preference?: DevicePreferences;
  preferencesByUser?: Record<string, Record<string, TemperatureThresholds>>;
  preferredEmail?: string;
  userAuthStatuses?: UserAuthStatus[];
  alerts?: ActiveAlert[];
  searchParams: ReturnType<typeof useSearchParams> | null;
}) {
  const currentAs = normalizeEmail(searchParams?.get("as") ?? undefined);
  const normalizedPreferred = normalizeEmail(preferredEmail);
  const thresholdsByUser = normalizeRecord(preferencesByUser?.[reading.deviceId]);
  const labelsByUser = normalizeRecord(preference?.labelsByUser);
  const uniqueEmails = Array.from(new Set([...Object.keys(thresholdsByUser), ...Object.keys(labelsByUser)])).filter(Boolean);

  if (uniqueEmails.length === 0) return null;

  return (
    <>
      {uniqueEmails.map((normalizedEmail) => {
        const displayEmail = normalizedEmail;
        // Show the user's custom label, or fall back to the device's default label
        const label = labelsByUser[normalizedEmail] ?? preference?.label ?? "Room label not set";
        const thresholds = thresholdsByUser[normalizedEmail];
        const thresholdState = getThresholdState(reading.temperatureC, thresholds);
        const isPreferred = normalizedPreferred ? normalizedPreferred === normalizedEmail : false;
        const isViewingThisUser = currentAs ? currentAs === normalizedEmail : false;
        const userStatus = userAuthStatuses?.find(
          (status) => status.email.toLowerCase() === normalizedEmail.toLowerCase()
        );
        const isUserOnline = userStatus?.isOnline ?? false;
        const lastEventTime = userStatus?.lastEventTime;
        const userAlert = alerts?.find(
          (a) => a.deviceId === reading.deviceId && a.userEmail === normalizedEmail
        );

        return (
          <article
            key={`${reading.deviceId}-${normalizedEmail}`}
            className={`flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/70 p-4 shadow-sm`}
          >
            {userAlert && (
              <div
                className={`rounded-xl border px-3 py-2 text-sm ${
                  userAlert.variant === "high"
                    ? "border-rose-200 bg-rose-50 text-rose-900"
                    : "border-sky-200 bg-sky-50 text-sky-900"
                }`}
                aria-live="polite"
              >
                <div className="flex items-center gap-2 font-semibold">
                  {userAlert.variant === "high" ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : (
                    <Thermometer className="h-4 w-4" />
                  )}
                  <span className="text-xs uppercase tracking-wide">
                    {userAlert.variant === "high" ? "High temp alert" : "Low temp alert"}
                  </span>
                </div>
                <p className="mt-1 text-xs">
                  {userAlert.variant === "high"
                    ? `Temperature ${userAlert.temperatureC.toFixed(1)}°C is above the ${userAlert.thresholdC.toFixed(1)}°C limit.`
                    : `Temperature ${userAlert.temperatureC.toFixed(1)}°C is below the ${userAlert.thresholdC.toFixed(1)}°C limit.`}
                </p>
              </div>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Room label</p>
                <p className="text-base font-semibold">{label}</p>
                {thresholdState.variant === "high" && (
                  <p className="text-sm font-medium text-rose-600">⚠️ Warning: Temp is too high</p>
                )}
                {thresholdState.variant === "low" && (
                  <p className="text-sm font-medium text-sky-600">⚠️ Warning: Temp is too low</p>
                )}
                <p className="text-xs text-muted-foreground">{displayEmail}</p>
              </div>
              <div className="flex items-center gap-2">
                {isPreferred && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                    Assigned
                  </span>
                )}
                <Button asChild type="button" size="sm" variant={isViewingThisUser ? "default" : "outline"}>
                  <Link href={`/user-dashboard?as=${encodeURIComponent(displayEmail)}`}>
                    {isViewingThisUser ? "Viewing" : "View"}
                  </Link>
                </Button>
                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
                      isUserOnline ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {isUserOnline ? <CheckCircle className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
                    {isUserOnline ? "Online" : "Offline"}
                  </span>
                  {lastEventTime && (
                    <span className="text-[10px] text-muted-foreground">
                      {isUserOnline
                        ? `Logged in ${formatRelativeTime(lastEventTime)}`
                        : `Logged out ${formatRelativeTime(lastEventTime)}`}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border/60 bg-background/90 p-3 shadow-inner">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current temp</p>
                <p
                  className={`text-2xl font-semibold ${
                    thresholdState.variant === "high"
                      ? "text-rose-600"
                      : thresholdState.variant === "low"
                        ? "text-sky-600"
                        : ""
                  }`}
                >
                  {reading.temperatureC.toFixed(1)}
                  <span className="ml-1 text-sm text-muted-foreground">°C</span>
                </p>
                <p className="text-xs text-muted-foreground">{thresholdState.message}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/90 p-3 shadow-inner">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Last update</p>
                <p className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
                  <Timer className="h-3.5 w-3.5" />
                  {formatTime(reading.ts)}
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-background/90 p-3 shadow-inner">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Thresholds</p>
                <p className="text-sm font-medium">{formatThresholdRange(thresholds)}</p>
                <p className="text-xs text-muted-foreground">Low · High</p>
              </div>
            </div>
          </article>
        );
      })}
    </>
  );
}

function AdminEmptyState() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-muted-foreground/40 bg-muted/30 px-8 py-12 text-center shadow-sm">
      <WifiOff className="h-10 w-10 text-muted-foreground" />
      <p className="text-base font-medium">No devices registered</p>
      <p className="text-sm text-muted-foreground">Connect a device to start monitoring rooms.</p>
    </div>
  );
}

function parseNumber(value: string): number | undefined {
  if (!value || !value.trim()) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.round(parsed * 10) / 10;
}

function formatThresholdRange(thresholds?: TemperatureThresholds): string {
  if (!thresholds) return "—";
  const { lowC, highC } = thresholds;
  if (lowC === undefined && highC === undefined) return "—";
  if (lowC !== undefined && highC !== undefined) {
    return `${lowC.toFixed(1)}°C – ${highC.toFixed(1)}°C`;
  }
  if (lowC !== undefined) return `≥ ${lowC.toFixed(1)}°C`;
  return `≤ ${highC!.toFixed(1)}°C`;
}

function getDeviceStatus(reading: Reading, nowMs: number) {
  const lastUpdate = getReadingTimestamp(reading);
  if (lastUpdate === null) {
    return { isOnline: false, label: "Unknown" };
  }
  const isOnline = nowMs - lastUpdate <= OFFLINE_THRESHOLD_MS;
  return {
    isOnline,
    label: `${isOnline ? "Online" : "Offline"} · ${formatTime(reading.ts)}`,
  };
}

function getReadingTimestamp(reading: Reading): number | null {
  const parsed = Date.parse(reading.ts);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function isReadingOnline(reading: Reading, nowMs: number): boolean {
  const lastUpdate = getReadingTimestamp(reading);
  if (lastUpdate === null) return false;
  return nowMs - lastUpdate <= OFFLINE_THRESHOLD_MS;
}

type ThresholdVariant = "ok" | "high" | "low";

interface ThresholdState {
  variant: ThresholdVariant;
  message: string;
}

function getThresholdState(temperatureC: number, thresholds?: TemperatureThresholds): ThresholdState {
  if (!thresholds || (thresholds.lowC === undefined && thresholds.highC === undefined)) {
    return { variant: "ok", message: "No thresholds configured yet." };
  }

  if (typeof thresholds.highC === "number" && temperatureC > thresholds.highC) {
    return {
      variant: "high",
      message: `Above ${thresholds.highC.toFixed(1)}°C high limit`,
    };
  }

  if (typeof thresholds.lowC === "number" && temperatureC < thresholds.lowC) {
    return {
      variant: "low",
      message: `Below ${thresholds.lowC.toFixed(1)}°C low limit`,
    };
  }

  return { variant: "ok", message: "Within configured range." };
}

function derivePreferencesFromLabels(labels: Record<string, string>): Record<string, DevicePreferences> {
  const result: Record<string, DevicePreferences> = {};
  for (const [deviceId, label] of Object.entries(labels)) {
    const trimmed = label?.trim();
    if (!trimmed) continue;
    result[deviceId] = { label: trimmed };
  }
  return result;
}

function deriveActiveAlertsFromReadings(
  readings: Reading[],
  preferences: Record<string, DevicePreferences>
): ActiveAlert[] {
  const derived: ActiveAlert[] = [];
  for (const reading of readings) {
    const preference = preferences[reading.deviceId];
    const thresholds = preference?.thresholds;
    if (!thresholds) continue;
    const state = getThresholdState(reading.temperatureC, thresholds);
    if (state.variant === "ok") continue;
    const thresholdC = state.variant === "high" ? thresholds.highC : thresholds.lowC;
    if (typeof thresholdC !== "number") continue;
    derived.push({
      deviceId: reading.deviceId,
      variant: state.variant,
      thresholdC,
      temperatureC: reading.temperatureC,
      triggeredAt: reading.ts,
      roomLabel: preference?.label,
    });
  }
  return derived;
}

function createDraftFromPreference(preference?: DevicePreferences): DeviceDraft {
  return {
    label: preference?.label ?? "",
    lowC: preference?.thresholds?.lowC !== undefined ? preference.thresholds.lowC.toString() : "",
    highC: preference?.thresholds?.highC !== undefined ? preference.thresholds.highC.toString() : "",
  };
}

function normalizeRecord<T>(input?: Record<string, T>): Record<string, T> {
  if (!input) return {};
  const out: Record<string, T> = {};
  for (const [email, value] of Object.entries(input)) {
    const normalized = normalizeEmail(email);
    if (!normalized) continue;
    out[normalized] = value;
  }
  return out;
}

function normalizeEmail(value?: string | null): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  return normalized || undefined;
}

