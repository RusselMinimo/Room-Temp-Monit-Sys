import { NextRequest } from "next/server";
import { subscribeToAuthLogs, listAuthLogs } from "@/lib/auth-logs";
import { getSession, isAdminEmail } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const session = await getSession();

  // Only admins can access auth logs
  if (!session || !isAdminEmail(session.email)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string) => controller.enqueue(encoder.encode(event));
      // Send initial data (latest logs)
      void (async () => {
        try {
          const initialLogs = await listAuthLogs(200);

          if (Array.isArray(initialLogs) && initialLogs.length > 0) {
            send(`data: ${JSON.stringify({ type: "initial", logs: initialLogs })}\n\n`);
          }
        } catch (error) {
          console.error("[auth-logs-stream] Failed to load initial logs:", error);
        }
      })();

      // Heartbeat to keep the connection alive (every 15s)
      const heartbeat = setInterval(() => send(`: ping\n\n`), 15000);

      // Subscribe to auth log events
      const unsubscribe = subscribeToAuthLogs((event) => {
        if (event.type === "new") {
          const data = JSON.stringify({ type: "update", log: event.entry });
          send(`data: ${data}\n\n`);
        } else if (event.type === "delete") {
          const data = JSON.stringify({ type: "delete", id: event.id });
          send(`data: ${data}\n\n`);
        } else if (event.type === "clear") {
          const data = JSON.stringify({ type: "clear" });
          send(`data: ${data}\n\n`);
        }
      });

      // Close handling
      const close = () => {
        clearInterval(heartbeat);
        unsubscribe();
        controller.close();
      };

      // Abort support (when client disconnects)
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

