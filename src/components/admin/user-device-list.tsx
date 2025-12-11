'use client'

import { useCallback, useEffect, useState } from "react";
import { Eye, Thermometer, User, Users, WifiOff, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LiveReadings } from "@/components/iot/live-readings";

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
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60_000);
    
    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  } catch {
    return "Invalid date";
  }
}

function UserDeviceCard({ user }: { user: UserManagementInfo }) {
  const [isViewingLiveData, setIsViewingLiveData] = useState(false);
  
  const totalDevices = user.monitoredDevices.length;
  const hasDevices = totalDevices > 0 || user.assignedDevice;

  // Handle escape key to close modal
  useEffect(() => {
    if (!isViewingLiveData) return;
    
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsViewingLiveData(false);
      }
    }
    
    window.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    
    return () => {
      window.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isViewingLiveData]);
  
  return (
    <>
      <div className="group relative overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all hover:shadow-md">
        <div className="p-6">
          {/* User Header */}
          <div className="mb-4 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-full ${
                user.isOnline 
                  ? 'bg-gradient-to-br from-green-500 to-green-600' 
                  : 'bg-gradient-to-br from-gray-400 to-gray-500'
              } text-white shadow-md`}>
                <User className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">{user.email}</h3>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {user.isOnline ? (
                    <>
                      <Wifi className="h-3 w-3 text-green-500" />
                      <span className="text-green-600 dark:text-green-400">Online</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-3 w-3 text-gray-500" />
                      <span>Offline</span>
                    </>
                  )}
                  {user.lastEventTime && (
                    <span className="ml-2">· {formatTimestamp(user.lastEventTime)}</span>
                  )}
                </div>
              </div>
            </div>
            
            {hasDevices && (
              <Button
                onClick={() => setIsViewingLiveData(true)}
                size="sm"
                className="gap-2"
              >
                <Eye className="h-4 w-4" />
                View Live Data
              </Button>
            )}
          </div>

          {/* Device Info */}
          {!hasDevices ? (
            <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20 px-4 py-6 text-center">
              <WifiOff className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">No devices assigned</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Assigned Device */}
              {user.assignedDevice && (
                <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Thermometer className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      Assigned Device
                    </span>
                  </div>
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Room:</span>
                      <span className="font-medium">{user.assignedDevice.roomLabel}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Device ID:</span>
                      <span className="font-mono text-xs">{user.assignedDevice.deviceId}</span>
                    </div>
                    {user.assignedDevice.lastReading && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Temperature:</span>
                        <span className="font-medium">
                          {user.assignedDevice.lastReading.temperatureC.toFixed(1)}°C
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Monitored Devices Summary */}
              {totalDevices > 0 && (
                <div className="rounded-lg bg-muted/50 border border-border p-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {totalDevices} {totalDevices === 1 ? 'Device' : 'Devices'} Monitored
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {user.monitoredDevices.slice(0, 3).map((device, idx) => (
                      <span 
                        key={device.deviceId || idx}
                        className="rounded bg-background px-2 py-1 text-xs border border-border"
                      >
                        {device.roomLabel}
                      </span>
                    ))}
                    {totalDevices > 3 && (
                      <span className="rounded bg-background px-2 py-1 text-xs border border-border text-muted-foreground">
                        +{totalDevices - 3} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Live Data Modal */}
      {isViewingLiveData && (
        <div 
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsViewingLiveData(false)}
        >
          <div className="h-full w-full overflow-y-auto">
            <div className="min-h-full flex items-start justify-center p-2 sm:p-4 md:p-6">
              <div 
                className="relative my-4 sm:my-6 md:my-8 w-full max-w-[95vw] sm:max-w-[90vw] md:max-w-6xl rounded-2xl border border-border bg-background shadow-2xl animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="sticky top-0 z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border bg-background/95 backdrop-blur-sm px-4 sm:px-6 py-4 rounded-t-2xl">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full shrink-0 ${
                      user.isOnline 
                        ? 'bg-gradient-to-br from-green-500 to-green-600' 
                        : 'bg-gradient-to-br from-gray-400 to-gray-500'
                    } text-white`}>
                      <User className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg sm:text-xl font-bold truncate">Live Readings - {user.email}</h2>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        Real-time temperature and humidity monitoring
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => setIsViewingLiveData(false)}
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                  >
                    Close
                  </Button>
                </div>

                {/* Modal Content */}
                <div className="p-4 sm:p-6">
                  <LiveReadingsWrapper userEmail={user.email} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function LiveReadingsWrapper({ userEmail }: { userEmail: string }) {
  useEffect(() => {
    // Update URL with user parameter for consistency
    const url = new URL(window.location.href);
    url.searchParams.set('as', userEmail);
    url.searchParams.set('demo', '1');
    window.history.replaceState({}, '', url.toString());

    return () => {
      // Clean up URL when modal closes
      const url = new URL(window.location.href);
      url.searchParams.delete('as');
      window.history.replaceState({}, '', url.toString());
    };
  }, [userEmail]);

  // Pass userEmail as prop to ensure proper user status checking
  return <LiveReadings viewAsUser={userEmail} key={userEmail} />;
}

export function UserDeviceList() {
  const [users, setUsers] = useState<UserManagementInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/user-management", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    const interval = setInterval(fetchUsers, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [fetchUsers]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-48 rounded-xl border border-border bg-muted/50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-muted-foreground/40 bg-muted/30 px-8 py-12 text-center">
        <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-semibold">No Users Found</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          There are no registered users in the system yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {users.map((user) => (
        <UserDeviceCard key={user.email} user={user} />
      ))}
    </div>
  );
}

