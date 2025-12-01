import { cn } from "@/lib/utils";
import { AlertCircle, Wifi, WifiOff } from "lucide-react";

interface ConnectionStatusProps {
  onlineRealDeviceCount: number;
  totalRealDeviceCount: number;
  demoDeviceCount: number;
  lastUpdate?: string;
  isAdmin?: boolean;
}

export function ConnectionStatus({
  onlineRealDeviceCount,
  totalRealDeviceCount,
  demoDeviceCount,
  lastUpdate,
  isAdmin,
}: ConnectionStatusProps) {
  const hasRealDevices = totalRealDeviceCount > 0;
  const isConnected = onlineRealDeviceCount > 0;
  const isOfflineOnly = hasRealDevices && !isConnected;
  const isDemo = !hasRealDevices && demoDeviceCount > 0;
  const hasSeenData = hasRealDevices || demoDeviceCount > 0;

  // For admins with no devices and no demo, suppress the banner entirely
  if (isAdmin && !hasRealDevices && !isDemo) {
    return null;
  }

  function getStatusMessage() {
    if (isConnected) {
      const label = onlineRealDeviceCount === 1 ? "Device" : "Devices";
      return `Connected - ${onlineRealDeviceCount} ${label} Active`;
    }
    if (isOfflineOnly) {
      const label = totalRealDeviceCount === 1 ? "Room" : "Rooms";
      return `Offline - ${totalRealDeviceCount} ${label}`;
    }
    if (isDemo) {
      return "Demo Mode - No Arduino Connected";
    }
    return hasSeenData ? "Awaiting Arduino Data" : "Awaiting Device Registration";
  }

  function getStatusIcon() {
    if (isConnected) return <Wifi className="h-4 w-4" />;
    if (isOfflineOnly) return <AlertCircle className="h-4 w-4" />;
    if (isDemo) return <WifiOff className="h-4 w-4" />;
    return <AlertCircle className="h-4 w-4" />;
  }

  function getStatusColor() {
    if (isConnected) return "text-green-600 bg-green-50 border-green-200";
    if (isOfflineOnly) return "text-amber-700 bg-amber-50 border-amber-200";
    if (isDemo) return "text-yellow-700 bg-yellow-50 border-yellow-200";
    return "text-red-600 bg-red-50 border-red-200";
  }

  function formatLastUpdate() {
    if (!lastUpdate) return null;
    const parsed = new Date(lastUpdate);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function getMetaText() {
    if (isConnected && lastUpdate) return `Last update: ${formatLastUpdate()}`;
    if (isOfflineOnly && lastUpdate) return `Last seen: ${formatLastUpdate()}`;
    if (isDemo && demoDeviceCount > 0) {
      const label = demoDeviceCount === 1 ? "demo device" : "demo devices";
      return `Seeding ${demoDeviceCount} ${label}`;
    }
    return undefined;
  }

  const metaText = getMetaText();

  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-xl border px-4 py-3 shadow-sm backdrop-blur-sm transition-all duration-300 sm:flex-row sm:items-center sm:justify-between hover:shadow-md",
        getStatusColor()
      )}
      role="status"
      aria-live="polite"
      aria-label="Device connection status"
    >
      <div className="flex items-center gap-2">
        <span className="animate-pulse" aria-hidden="true">{getStatusIcon()}</span>
        <span className="text-sm font-semibold">{getStatusMessage()}</span>
      </div>
      {metaText && (
        <span className="text-xs font-medium opacity-80 sm:text-right">
          {metaText}
        </span>
      )}
    </div>
  );
}
