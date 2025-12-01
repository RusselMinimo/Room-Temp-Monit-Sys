export interface TemperatureSample {
  ts: string;
  temperatureC: number;
}

interface TemperatureChartProps {
  data: TemperatureSample[];
}

export function TemperatureChart({ data }: TemperatureChartProps) {
  const clampedData = data.slice(-60);

  if (clampedData.length < 2) {
    return (
      <div className="rounded-2xl border border-dashed border-muted-foreground/50 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
        Waiting for at least two readings to draw the trend.
      </div>
    );
  }

  const temperatures = clampedData.map((point) => point.temperatureC);
  const min = Math.min(...temperatures);
  const max = Math.max(...temperatures);
  const range = max - min || 1;

  const coords = clampedData.map((point, index) => {
    const x = (index / (clampedData.length - 1)) * 100;
    const y = 100 - ((point.temperatureC - min) / range) * 100;
    return { x, y };
  });

  const pointString = coords.map(({ x, y }) => `${x},${y}`).join(" ");
  const lastPoint = coords[coords.length - 1];

  const firstLabel = safeFormat(clampedData[0].ts);
  const lastLabel = safeFormat(clampedData[clampedData.length - 1].ts);

  return (
    <div className="rounded-2xl border border-border bg-background/80 p-5 shadow-inner">
      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span>Temperature trend (last {clampedData.length}s)</span>
        <span>
          {min.toFixed(1)}°C – {max.toFixed(1)}°C
        </span>
      </div>

      <svg viewBox="0 0 100 100" className="mt-4 h-40 w-full">
        <defs>
          <linearGradient id="tempGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.4" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          points={pointString}
        />
        <polygon
          fill="url(#tempGradient)"
          opacity={0.4}
          points={`${pointString} 100,100 0,100`}
        />
        <circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r={2.5}
          fill="hsl(var(--primary))"
        />
      </svg>

      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>{firstLabel}</span>
        <span>{lastLabel}</span>
      </div>
    </div>
  );
}

function safeFormat(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}


