import { cn } from "@/lib/utils";
import { AlertCircle, Wifi, WifiOff } from "lucide-react";

interface ConnectionStatusProps {
  realDeviceCount: number;
  demoDeviceCount: number;
  lastUpdate?: string;
}

export function ConnectionStatus({ realDeviceCount, demoDeviceCount, lastUpdate }: ConnectionStatusProps) {
  const totalDevices = realDeviceCount + demoDeviceCount;
  const isConnected = realDeviceCount > 0;
  const isDemo = !isConnected && demoDeviceCount > 0;
  const hasSeenData = totalDevices > 0;

  function getStatusMessage() {
    if (isConnected) {
      const label = realDeviceCount === 1 ? "Device" : "Devices";
      return `Connected - ${realDeviceCount} ${label} Active`;
    }
    if (isDemo) {
      return "Demo Mode - No Arduino Connected";
    }
    return hasSeenData ? "Awaiting Arduino Data" : "Arduino Not Detected";
  }

  function getStatusIcon() {
    if (isConnected) return <Wifi className="h-4 w-4" />;
    if (isDemo) return <WifiOff className="h-4 w-4" />;
    return <AlertCircle className="h-4 w-4" />;
  }

  function getStatusColor() {
    if (isConnected) return "text-green-600 bg-green-50 border-green-200";
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
        "flex items-center justify-between rounded-lg border px-4 py-2",
        getStatusColor()
      )}
    >
      <div className="flex items-center gap-2">
        {getStatusIcon()}
        <span className="text-sm font-medium">{getStatusMessage()}</span>
      </div>
      {metaText && <span className="text-xs opacity-75">{metaText}</span>}
    </div>
  );
}
