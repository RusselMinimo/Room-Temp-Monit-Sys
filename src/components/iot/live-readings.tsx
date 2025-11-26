'use client'

import { useEffect, useState } from "react";
import type { Reading } from "@/lib/store";
import { ConnectionStatus } from "./connection-status";
import { Droplets, Thermometer, WifiOff } from "lucide-react";

interface ApiResponse {
  readings: Reading[];
  realDeviceCount: number;
  demoDeviceCount: number;
  isDemoMode: boolean;
}

export function LiveReadings() {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [hasError, setHasError] = useState<boolean>(false);
  const [isRealtime, setIsRealtime] = useState<boolean>(false);

  useEffect(function startPolling() {
    let cancelled = false;

    async function fetchOnce() {
      try {
        const res = await fetch("/api/readings?demo=1", { cache: "no-store" });
        if (!res.ok) throw new Error("Request failed");
        const data = (await res.json()) as ApiResponse;
        if (!cancelled) setReadings(data.readings);
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
  }, []);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading readings…</div>;
  }

  if (hasError) {
    return <div className="text-sm text-destructive">Failed to load readings. Retrying…</div>;
  }

  const realReadings = readings.filter((reading) => reading.isDemo !== true);
  const demoReadings = readings.filter((reading) => reading.isDemo === true);
  const realDeviceCount = realReadings.length;
  const demoDeviceCount = demoReadings.length;
  const latestReal = selectLatestReading(realReadings);
  const latestDemo = selectLatestReading(demoReadings);
  const primaryReading = latestReal ?? latestDemo ?? selectLatestReading(readings);
  const lastUpdateForStatus = latestReal?.ts ?? primaryReading?.ts;
  const isDemoMode = !latestReal && Boolean(latestDemo);
  const connectionLabel = isRealtime && realDeviceCount > 0 ? "Realtime via SSE" : "Polling every 1s";

  return (
    <div className="flex flex-col gap-4">
      <ConnectionStatus
        realDeviceCount={realDeviceCount}
        demoDeviceCount={demoDeviceCount}
        lastUpdate={lastUpdateForStatus}
      />

      {isDemoMode && (
        <div className="mx-auto w-full max-w-xl rounded-lg border border-yellow-200/70 bg-yellow-50 px-4 py-3 text-sm text-yellow-900 shadow-sm">
          Demo mode is seeding a virtual sensor. Connect your Arduino to replace it with live data.
        </div>
      )}

      {!primaryReading ? (
        <EmptyState />
      ) : (
        <>
          <ReadingHero reading={primaryReading} isDemo={primaryReading.isDemo === true} />
          <div className="text-center text-xs text-muted-foreground">{connectionLabel}</div>
        </>
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
}

function ReadingHero({ reading, isDemo }: ReadingHeroProps) {
  const time = formatTime(reading.ts);
  const humidityValue = typeof reading.humidityPct === "number" ? reading.humidityPct : undefined;
  const rssiValue = typeof reading.rssi === "number" ? `${reading.rssi} dBm` : undefined;

  return (
    <div className="mx-auto w-full max-w-xl">
      <div className="overflow-hidden rounded-2xl border border-border bg-card/80 shadow-sm backdrop-blur">
        <div className="flex items-center justify-between gap-4 border-b border-border/60 bg-muted/40 px-6 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Device</p>
            <p className="text-lg font-semibold">{reading.deviceId}</p>
            <p className="text-xs text-muted-foreground">Last update {time}</p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${isDemo ? "bg-yellow-100 text-yellow-900" : "bg-emerald-100 text-emerald-800"}`}
          >
            {isDemo ? "Demo Data" : "Live Data"}
          </span>
        </div>

        <div className="grid gap-4 px-6 py-6 sm:grid-cols-2">
          <div className="rounded-xl border border-border/60 bg-background/80 p-5 shadow-inner">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Thermometer className="h-4 w-4" />
              Temperature
            </div>
            <div className="mt-4 text-5xl font-semibold tracking-tight">
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

          {rssiValue && (
            <div className="rounded-xl border border-border/60 bg-background/80 p-5 shadow-inner sm:col-span-2">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Signal Strength</div>
              <div className="mt-3 text-2xl font-semibold">{rssiValue}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function EmptyState() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-muted-foreground/40 bg-muted/30 px-8 py-12 text-center shadow-sm">
      <WifiOff className="h-10 w-10 text-muted-foreground" />
      <p className="text-base font-medium">Waiting for the first reading</p>
      <p className="text-sm text-muted-foreground">
        Power on your Arduino and ensure it POSTs data to <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs">/api/ingest</span>.
      </p>
    </div>
  );
}

