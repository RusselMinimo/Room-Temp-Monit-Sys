import { NextRequest } from "next/server";
import { subscribeToReadings } from "@/lib/bus";
import { getSession, isAdminEmail } from "@/lib/auth";
import { getAssignedDeviceId } from "@/lib/assignments";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const session = await getSession();
  const isAdmin = session ? isAdminEmail(session.email) : false;
  const assigned = session && !isAdmin ? getAssignedDeviceId(session.email) : undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string) => controller.enqueue(encoder.encode(event));

      // Heartbeat to keep the connection alive (every 15s)
      const heartbeat = setInterval(() => send(`: ping\n\n`), 15000);

      const unsubscribe = subscribeToReadings((reading) => {
        // Scope events for non-admins to their assigned device.
        // Admin dashboard should not receive demo readings.
        if (!isAdmin) {
          if (reading.isDemo === true) {
            // allow
          } else if (!assigned || reading.deviceId !== assigned) {
            return; // drop events for other rooms
          }
        } else if (reading.isDemo === true) {
          return; // drop demo events for admin
        }
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
      // If available in this runtime, hook into the abort signal to close cleanly.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyReq: any = _req as any;
      if (anyReq?.signal && typeof anyReq.signal.addEventListener === "function") {
        anyReq.signal.addEventListener("abort", close);
      }
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


