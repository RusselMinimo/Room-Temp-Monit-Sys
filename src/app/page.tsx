import { Suspense } from "react";
import { LiveReadings } from "@/components/iot/live-readings";

export default function Home() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">IoT Room Temperature</h1>
        <p className="text-sm text-muted-foreground">
          Live readings from your sensors. This demo seeds data automatically.
        </p>
      </header>
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
        <LiveReadings />
      </Suspense>
    </div>
  );
}
