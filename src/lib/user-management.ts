import "server-only";

import { listNonAdminUserEmails, findUser, type UserRecord } from "./users";
import { getAssignedDeviceId } from "./assignments";
import { listDevicePreferences } from "./device-preferences";
import { getUserAuthStatuses, type UserAuthStatus } from "./auth-logs";
import { getLatestReading } from "./store";

export interface UserDeviceInfo {
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

export interface UserManagementInfo {
  email: string;
  createdAt: number;
  isOnline: boolean;
  lastEventType?: string;
  lastEventTime?: string;
  assignedDevice?: UserDeviceInfo;
  monitoredDevices: UserDeviceInfo[];
}

export async function getUserManagementData(): Promise<UserManagementInfo[]> {
  const userEmails = await listNonAdminUserEmails();
  const authStatuses = getUserAuthStatuses();
  const devicePreferences = listDevicePreferences();
  
  const statusMap = new Map<string, UserAuthStatus>();
  for (const status of authStatuses) {
    statusMap.set(status.email.toLowerCase(), status);
  }
  
  const users: UserManagementInfo[] = [];
  
  for (const email of userEmails) {
    const normalizedEmail = email.toLowerCase();
    const userRecord = await findUser(email);
    const authStatus = statusMap.get(normalizedEmail);
    const assignedDeviceId = getAssignedDeviceId(email);
    
    // Get assigned device info
    let assignedDevice: UserDeviceInfo | undefined;
    if (assignedDeviceId) {
      const devicePref = devicePreferences[assignedDeviceId];
      const userLabel = devicePref?.labelsByUser?.[normalizedEmail];
      const defaultLabel = devicePref?.label;
      const userThresholds = devicePref?.thresholdsByUser?.[normalizedEmail];
      const reading = getLatestReading(assignedDeviceId);
      
      assignedDevice = {
        deviceId: assignedDeviceId,
        roomLabel: userLabel ?? defaultLabel ?? "Unlabeled Room",
        thresholds: userThresholds ? {
          lowC: userThresholds.lowC,
          highC: userThresholds.highC,
        } : undefined,
        lastReading: reading ? {
          temperatureC: reading.temperatureC,
          humidityPct: reading.humidityPct,
          timestamp: reading.ts,
        } : undefined,
      };
    }
    
    // Get all devices this user monitors (has custom labels/thresholds for)
    const monitoredDevices: UserDeviceInfo[] = [];
    for (const [deviceId, devicePref] of Object.entries(devicePreferences)) {
      // Check if user has custom labels or thresholds for this device
      const userLabel = devicePref.labelsByUser?.[normalizedEmail];
      const userThresholds = devicePref.thresholdsByUser?.[normalizedEmail];
      
      if (userLabel || userThresholds) {
        const reading = getLatestReading(deviceId);
        monitoredDevices.push({
          deviceId,
          roomLabel: userLabel ?? devicePref.label ?? "Unlabeled Room",
          thresholds: userThresholds ? {
            lowC: userThresholds.lowC,
            highC: userThresholds.highC,
          } : undefined,
          lastReading: reading ? {
            temperatureC: reading.temperatureC,
            humidityPct: reading.humidityPct,
            timestamp: reading.ts,
          } : undefined,
        });
      }
    }
    
    users.push({
      email,
      createdAt: userRecord?.createdAt ?? Date.now(),
      isOnline: authStatus?.isOnline ?? false,
      lastEventType: authStatus?.lastEvent,
      lastEventTime: authStatus?.lastEventTime,
      assignedDevice,
      monitoredDevices,
    });
  }
  
  // Sort by online status first, then by creation date (newest first)
  users.sort((a, b) => {
    if (a.isOnline !== b.isOnline) {
      return a.isOnline ? -1 : 1;
    }
    return b.createdAt - a.createdAt;
  });
  
  return users;
}

