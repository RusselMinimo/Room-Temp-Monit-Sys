"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

interface AuthLogEntry {
  id: string;
  email: string;
  event: "login_success" | "login_failure" | "logout" | "signup";
  ip?: string;
  userAgent?: string;
  timestamp: number;
  details?: string;
}

interface AuthLogsRealtimeProps {
  initialLogs: AuthLogEntry[];
  onDelete: (formData: FormData) => Promise<void>;
}

export function AuthLogsRealtime({ initialLogs, onDelete }: AuthLogsRealtimeProps) {
  const [logs, setLogs] = useState<AuthLogEntry[]>(initialLogs);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;

    function connect() {
      setConnectionStatus("connecting");
      eventSource = new EventSource("/api/auth-logs-stream");

      eventSource.onopen = () => {
        setConnectionStatus("connected");
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === "initial" && data.logs) {
            // Replace with initial logs
            setLogs(data.logs);
          } else if (data.type === "update" && data.log) {
            // Prepend new log entry (since logs are shown in reverse chronological order)
            setLogs((prev) => [data.log, ...prev]);
          } else if (data.type === "delete" && data.id) {
            // Remove the deleted log entry
            setLogs((prev) => prev.filter((log) => log.id !== data.id));
          } else if (data.type === "clear") {
            // Clear all logs
            setLogs([]);
          }
        } catch (error) {
          console.error("Failed to parse SSE message:", error);
        }
      };

      eventSource.onerror = () => {
        setConnectionStatus("disconnected");
        eventSource?.close();
        
        // Attempt to reconnect after 3 seconds
        reconnectTimer = setTimeout(() => {
          connect();
        }, 3000);
      };
    }

    connect();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Status:</span>
        <div className="flex items-center gap-2">
          {connectionStatus === "connected" && (
            <>
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-green-600 font-medium">Live</span>
            </>
          )}
          {connectionStatus === "connecting" && (
            <>
              <span className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse"></span>
              <span className="text-yellow-600 font-medium">Connecting...</span>
            </>
          )}
          {connectionStatus === "disconnected" && (
            <>
              <span className="h-2 w-2 rounded-full bg-red-500"></span>
              <span className="text-red-600 font-medium">Disconnected</span>
            </>
          )}
        </div>
      </div>

      {/* Logs Table */}
      <section className="overflow-x-auto rounded-2xl border border-border/70 bg-card/70 shadow">
        <div className="min-w-[800px]">
          <div className="grid grid-cols-[2fr_1fr_1fr_2fr_auto] gap-4 border-b border-border/60 bg-muted/40 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>User / Event</span>
            <span>Timestamp</span>
            <span>IP</span>
            <span>User Agent</span>
            <span className="text-right">Actions</span>
          </div>
          <div className="divide-y divide-border/60">
            {logs.length === 0 && (
              <div className="px-4 py-6 text-sm text-muted-foreground">No authentication activity yet.</div>
            )}
            {logs.map((log) => (
              <article key={log.id} className="grid grid-cols-[2fr_1fr_1fr_2fr_auto] items-center gap-4 px-4 py-3 text-sm animate-in fade-in duration-300">
                <div>
                  <p className="font-medium text-foreground">{log.email}</p>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                      log.event === "login_success"
                        ? "bg-emerald-50 text-emerald-700"
                        : log.event === "login_failure"
                          ? "bg-rose-50 text-rose-700"
                          : log.event === "logout"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-sky-50 text-sky-700"
                    }`}>
                      {log.event.replace("_", " ")}
                    </span>
                    {log.details && <span className="text-xs text-muted-foreground">{log.details}</span>}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(log.timestamp).toLocaleString(undefined, { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" })}
                </div>
                <div className="text-xs text-muted-foreground">{log.ip ?? "—"}</div>
                <div className="text-xs text-muted-foreground truncate">{log.userAgent ?? "—"}</div>
                <div className="flex justify-end">
                  <form action={onDelete}>
                    <input type="hidden" name="id" value={log.id} />
                    <Button type="submit" size="sm" variant="destructive">Delete</Button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

