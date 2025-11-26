import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Reading } from "@/lib/store";

export interface ReadingCardProps {
  reading: Reading;
}

export function ReadingCard({ reading }: ReadingCardProps) {
  const date = new Date(reading.ts);
  const time = isNaN(date.getTime()) ? "" : date.toLocaleTimeString();

  return (
    <Card className="max-w-sm">
      <CardHeader>
        <CardTitle className="text-lg">{reading.deviceId}</CardTitle>
        <CardDescription>Last update {time || "—"}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-4">
          <div className="text-4xl font-semibold">
            {reading.temperatureC.toFixed(1)}
            <span className="ml-1 text-lg text-muted-foreground">°C</span>
          </div>
          {typeof reading.humidityPct === "number" && (
            <div className="text-lg text-muted-foreground">{reading.humidityPct}% RH</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}


