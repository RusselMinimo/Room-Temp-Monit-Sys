import { NextRequest } from "next/server";
import { subscribeToReadings } from "@/lib/bus";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string) => controller.enqueue(encoder.encode(event));

      // Heartbeat to keep the connection alive (every 15s)
      const heartbeat = setInterval(() => send(`: ping\n\n`), 15000);

      const unsubscribe = subscribeToReadings((reading) => {
        const data = JSON.stringify(reading);
        send(`data: ${data}\n\n`);
      });

      // Close handling
      const close = () => {
        clearInterval(heartbeat);
        unsubscribe();
        controller.close();
      };

      // Abort support (when client disconnects)
      // @ts-ignore - controller has signal on underlying request in runtime
      // If not available, it will simply noop.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyReq: any = _req as any;
      if (anyReq?.signal) anyReq.signal.addEventListener("abort", close);
    },
    cancel() {},
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}


