import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { subscribeOrder, type OrderEvent } from "@/lib/order-events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const POLL_MS = 2500;
const HEARTBEAT_MS = 25000;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; orderId: string }> }
) {
  const { slug, orderId } = await params;

  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, updatedAt: true, restaurantId: true, restaurant: { select: { slug: true } } },
  });
  if (!order || order.restaurant.slug !== slug) {
    return new Response("Not found", { status: 404 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let lastStatus = order.status;
      let lastUpdatedAt = order.updatedAt;

      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };
      const send = (event: string, data: unknown) => {
        safeEnqueue(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      send("connected", { orderId, status: lastStatus, ts: Date.now() });

      const onEvent = (evt: OrderEvent) => {
        if (closed) return;
        if (evt.status !== lastStatus) {
          lastStatus = evt.status;
          lastUpdatedAt = new Date(evt.ts);
          send("order:update", evt);
        }
      };
      const unsubscribe = subscribeOrder(orderId, onEvent);

      const pollTimer = setInterval(async () => {
        if (closed) return;
        try {
          const fresh = await db.order.findUnique({
            where: { id: orderId },
            select: { status: true, updatedAt: true, orderNumber: true },
          });
          if (!fresh) return;
          if (fresh.status !== lastStatus || fresh.updatedAt > lastUpdatedAt) {
            lastStatus = fresh.status;
            lastUpdatedAt = fresh.updatedAt;
            send("order:update", {
              kind: "updated",
              restaurantId: order.restaurantId,
              orderId,
              orderNumber: fresh.orderNumber,
              status: fresh.status,
              ts: fresh.updatedAt.getTime(),
            } satisfies OrderEvent);
          }
        } catch (e) {
          console.error("[sse] order poll error", e);
        }
      }, POLL_MS);

      const heartbeatTimer = setInterval(() => {
        safeEnqueue(`: ping ${Date.now()}\n\n`);
      }, HEARTBEAT_MS);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(pollTimer);
        clearInterval(heartbeatTimer);
        unsubscribe();
        try {
          controller.close();
        } catch {}
      };

      req.signal.addEventListener("abort", cleanup);
    },
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
