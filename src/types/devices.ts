export interface TemperatureThresholds {
  lowC?: number;
  highC?: number;
}

export interface DevicePreferences {
  label?: string;
  thresholds?: TemperatureThresholds;
  // For admin visibility; not sent to non-admin clients
  thresholdsByUser?: Record<string, TemperatureThresholds>;
  // Per-user label overrides (non-admin); admins see global labels
  labelsByUser?: Record<string, string>;
}


