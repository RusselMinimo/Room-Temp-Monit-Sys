"use client";

import { useEffect, useState } from "react";
import { Users, Wifi, WifiOff, MonitorSmartphone, ThermometerSun, Droplets, Clock } from "lucide-react";
import { getUserManagementAction } from "@/actions/user-management";

interface UserDeviceInfo {
  deviceId?: string;
  roomLabel?: string;
  thresholds?: {
    lowC?: number;
    highC?: number;
  };
  lastReading?: {
    temperatureC: number;
    humidityPct?: number;
    timestamp: string;
  };
}

interface UserManagementInfo {
  email: string;
  createdAt: number;
  isOnline: boolean;
  lastEventType?: string;
  lastEventTime?: string;
  assignedDevice?: UserDeviceInfo;
  monitoredDevices: UserDeviceInfo[];
}

function formatTimestamp(isoString: string | undefined): string {
  if (!isoString) return "Never";
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  
  return date.toLocaleDateString();
}

function formatDateTime(isoString: string | undefined): string {
  if (!isoString) return "Never";
  const date = new Date(isoString);
  return date.toLocaleString();
}

function formatTemperature(tempC: number, preferCelsius = true): string {
  if (preferCelsius) {
    return `${tempC.toFixed(1)}°C`;
  }
  const tempF = (tempC * 9) / 5 + 32;
  return `${tempF.toFixed(1)}°F`;
}

function DeviceCard({ device }: { device: UserDeviceInfo }) {
  const isStale = device.lastReading 
    ? Date.now() - new Date(device.lastReading.timestamp).getTime() > 300000 // 5 minutes
    : true;
  
  return (
    <div className={`rounded-lg border p-3 transition-colors ${
      isStale 
        ? "border-border/50 bg-muted/30" 
        : "border-border bg-card"
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <MonitorSmartphone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{device.roomLabel}</p>
            <p className="text-xs text-muted-foreground truncate">{device.deviceId}</p>
          </div>
        </div>
        {device.lastReading && (
          <div className={`flex items-center gap-2 text-xs flex-shrink-0 ${
            isStale ? "text-muted-foreground" : "text-foreground"
          }`}>
            <div className="flex items-center gap-1">
              <ThermometerSun className="h-3 w-3" />
              <span className="font-medium">{formatTemperature(device.lastReading.temperatureC)}</span>
            </div>
            {device.lastReading.humidityPct !== undefined && (
              <div className="flex items-center gap-1">
                <Droplets className="h-3 w-3" />
                <span className="font-medium">{device.lastReading.humidityPct.toFixed(0)}%</span>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Thresholds */}
      {device.thresholds && (device.thresholds.lowC !== undefined || device.thresholds.highC !== undefined) && (
        <div className="mt-2 flex items-center gap-3 text-xs">
          <span className="text-muted-foreground">Thresholds:</span>
          {device.thresholds.lowC !== undefined && (
            <span className="rounded bg-blue-500/10 px-2 py-0.5 font-medium text-blue-700 dark:text-blue-400">
              Low: {formatTemperature(device.thresholds.lowC)}
            </span>
          )}
          {device.thresholds.highC !== undefined && (
            <span className="rounded bg-red-500/10 px-2 py-0.5 font-medium text-red-700 dark:text-red-400">
              High: {formatTemperature(device.thresholds.highC)}
            </span>
          )}
        </div>
      )}
      
      {device.lastReading && (
        <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{formatTimestamp(device.lastReading.timestamp)}</span>
        </div>
      )}
      {!device.lastReading && (
        <p className="mt-2 text-xs text-muted-foreground italic">No recent data</p>
      )}
    </div>
  );
}

function UserCard({ user }: { user: UserManagementInfo }) {
  const totalDevices = user.monitoredDevices.length;
  const hasAssignment = !!user.assignedDevice;
  
  return (
    <article className="rounded-xl border border-border/70 bg-card/80 p-6 shadow-sm backdrop-blur-sm transition-all hover:shadow-lg">
      {/* User Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full flex-shrink-0 ${
            user.isOnline 
              ? "bg-gradient-to-br from-green-600 to-green-400" 
              : "bg-gradient-to-br from-gray-600 to-gray-400"
          } text-white shadow-lg`}>
            <Users className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold truncate">{user.email}</h3>
            <p className="text-xs text-muted-foreground">
              Registered {formatTimestamp(new Date(user.createdAt).toISOString())}
            </p>
          </div>
        </div>
        <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium flex-shrink-0 ${
          user.isOnline
            ? "bg-green-500/10 text-green-700 dark:text-green-400"
            : "bg-gray-500/10 text-gray-700 dark:text-gray-400"
        }`}>
          {user.isOnline ? (
            <>
              <Wifi className="h-3 w-3" />
              <span>Online</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3" />
              <span>Offline</span>
            </>
          )}
        </div>
      </div>

      {/* Last Activity */}
      {user.lastEventTime && (
        <div className="mb-4 rounded-lg bg-muted/50 p-3">
          <div className="flex items-center gap-2 text-xs">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Last activity:</span>
            <span className="font-medium">
              {user.lastEventType === "login_success" ? "Logged in" : 
               user.lastEventType === "logout" ? "Logged out" : 
               user.lastEventType === "signup" ? "Signed up" : "Unknown"}
            </span>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground">{formatTimestamp(user.lastEventTime)}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {formatDateTime(user.lastEventTime)}
          </div>
        </div>
      )}

      {/* Assigned Device */}
      {hasAssignment && user.assignedDevice && (
        <div className="mb-4">
          <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
            Assigned Device
          </h4>
          <DeviceCard device={user.assignedDevice} />
        </div>
      )}

      {/* Monitored Devices */}
      {totalDevices > 0 && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
            Monitored Devices ({totalDevices})
          </h4>
          <div className="space-y-2">
            {user.monitoredDevices.map((device) => (
              <DeviceCard key={device.deviceId} device={device} />
            ))}
          </div>
        </div>
      )}

      {/* No Devices */}
      {!hasAssignment && totalDevices === 0 && (
        <div className="rounded-lg border border-dashed border-border p-4 text-center">
          <MonitorSmartphone className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No devices assigned or monitored</p>
        </div>
      )}
    </article>
  );
}

export function UserManagementRealtime() {
  const [users, setUsers] = useState<UserManagementInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      const data = await getUserManagementAction();
      setUsers(data);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch user management data:", err);
      setError("Failed to load user data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    
    // Poll every 5 seconds for updates
    const interval = setInterval(fetchUsers, 5000);
    
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-border/70 bg-card/80 p-8 text-center shadow-sm backdrop-blur-sm">
        <div className="flex items-center justify-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading user data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center shadow-sm dark:border-red-900 dark:bg-red-950/50">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="rounded-xl border border-border/70 bg-card/80 p-8 text-center shadow-sm backdrop-blur-sm">
        <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
        <h3 className="text-lg font-semibold mb-2">No Registered Users</h3>
        <p className="text-sm text-muted-foreground">
          No users have registered yet. Users will appear here once they sign up.
        </p>
      </div>
    );
  }

  const onlineUsers = users.filter(u => u.isOnline).length;
  const offlineUsers = users.length - onlineUsers;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-medium text-muted-foreground">Total Users</h3>
          </div>
          <p className="mt-2 text-2xl font-bold">{users.length}</p>
        </div>
        
        <div className="rounded-xl border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Wifi className="h-5 w-5 text-green-600" />
            <h3 className="text-sm font-medium text-muted-foreground">Online</h3>
          </div>
          <p className="mt-2 text-2xl font-bold text-green-600">{onlineUsers}</p>
        </div>
        
        <div className="rounded-xl border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <WifiOff className="h-5 w-5 text-gray-600" />
            <h3 className="text-sm font-medium text-muted-foreground">Offline</h3>
          </div>
          <p className="mt-2 text-2xl font-bold text-gray-600">{offlineUsers}</p>
        </div>
      </div>

      {/* User Cards Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {users.map((user) => (
          <UserCard key={user.email} user={user} />
        ))}
      </div>
    </div>
  );
}

