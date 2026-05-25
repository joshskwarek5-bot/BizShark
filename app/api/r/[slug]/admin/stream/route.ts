import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireRestaurantAdmin } from "@/lib/auth";
import { subscribeRestaurant, type OrderEvent } from "@/lib/order-events";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const POLL_MS = 2500;
const HEARTBEAT_MS = 25000;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const auth = await requireRestaurantAdmin(slug);
  if (!auth.authorized) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { restaurant } = auth;

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let lastUpdatedAt: Date = await getMostRecentUpdate(restaurant.id);

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

      // Initial hello — client uses this to confirm connection
      send("connected", { restaurantId: restaurant.id, ts: Date.now() });

      const onEvent = (evt: OrderEvent) => {
        if (closed) return;
        if (new Date(evt.ts) > lastUpdatedAt) lastUpdatedAt = new Date(evt.ts);
        send(evt.kind === "created" ? "order:new" : "order:update", evt);
      };
      const unsubscribe = subscribeRestaurant(restaurant.id, onEvent);

      // DB-poll fallback: picks up updates from other instances (or any miss).
      const pollTimer = setInterval(async () => {
        if (closed) return;
        try {
          const recent = await db.order.findMany({
            where: {
              restaurantId: restaurant.id,
              updatedAt: { gt: lastUpdatedAt },
            },
            orderBy: { updatedAt: "asc" },
            select: { id: true, orderNumber: true, status: true, updatedAt: true, createdAt: true },
            take: 50,
          });
          if (recent.length > 0) {
            console.log(`[sse:admin ${restaurant.slug}] poll found ${recent.length} updates since ${lastUpdatedAt.toISOString()}`);
          }
          for (const o of recent) {
            const kind: OrderEvent["kind"] =
              o.createdAt.getTime() === o.updatedAt.getTime() ? "created" : "updated";
            send(kind === "created" ? "order:new" : "order:update", {
              kind,
              restaurantId: restaurant.id,
              orderId: o.id,
              orderNumber: o.orderNumber,
              status: o.status,
              ts: o.updatedAt.getTime(),
            } satisfies OrderEvent);
            lastUpdatedAt = o.updatedAt;
          }
        } catch (e) {
          console.error("[sse] poll error", e);
        }
      }, POLL_MS);

      // Heartbeat keeps proxies/load-balancers from dropping the connection.
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
    cancel() {
      // ReadableStream cancel is called when consumer disconnects
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

async function getMostRecentUpdate(restaurantId: string): Promise<Date> {
  const r = await db.order.findFirst({
    where: { restaurantId },
    orderBy: { updatedAt: "desc" },
    select: { updatedAt: true },
  });
  return r?.updatedAt ?? new Date(0);
}
