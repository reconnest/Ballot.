import { NextRequest } from "next/server";
import { subscribeToPoll } from "@/lib/realtime";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const slug = params.slug;

  const encoder = new TextEncoder();
  let cleanupSubscription: (() => void) | null = null;
  let heartbeatTimer: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // 1. Subscribe to realtime room updates
      cleanupSubscription = subscribeToPoll(slug, (data) => {
        try {
          const chunk = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // Stream might be closed by client
        }
      });

      // 2. Initial connection handshake
      const initialChunk = `data: ${JSON.stringify({ type: "connected", slug })}\n\n`;
      controller.enqueue(encoder.encode(initialChunk));

      // 3. Keepalive heartbeat ping every 15s to keep NAT/firewalls open
      heartbeatTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          if (heartbeatTimer) clearInterval(heartbeatTimer);
        }
      }, 15000);
    },
    cancel() {
      if (cleanupSubscription) cleanupSubscription();
      if (heartbeatTimer) clearInterval(heartbeatTimer);
    },
  });

  // ── Fix 2.2: Guarantee cleanup via req.signal abort — reliable on all Vercel runtimes ──
  req.signal.addEventListener("abort", () => {
    if (cleanupSubscription) {
      cleanupSubscription();
      cleanupSubscription = null;
    }
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }, { once: true });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

