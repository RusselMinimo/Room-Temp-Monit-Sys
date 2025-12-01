export type AlertVariant = "high" | "low";

export interface ActiveAlert {
  deviceId: string;
  variant: AlertVariant;
  temperatureC: number;
  thresholdC: number;
  triggeredAt: string;
  roomLabel?: string;
  userEmail?: string; // owner of the threshold that triggered
}



