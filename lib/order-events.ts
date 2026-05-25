import { EventEmitter } from "node:events";

// Global EventEmitter survives hot-reloads in dev and is shared across
// concurrent requests within a single Node process. Order actions emit
// into it; SSE handlers subscribe. Cross-instance broadcasts (multi-region
// Vercel) are picked up by the DB-poll fallback inside each handler.
declare global {
  // eslint-disable-next-line no-var
  var __orderEvents: EventEmitter | undefined;
}

const events = globalThis.__orderEvents ?? new EventEmitter();
if (!globalThis.__orderEvents) {
  events.setMaxListeners(500);
  globalThis.__orderEvents = events;
}

export interface OrderEvent {
  kind: "created" | "updated";
  restaurantId: string;
  orderId: string;
  orderNumber: number;
  status: string;
  ts: number;
}

export function restaurantChannel(restaurantId: string) {
  return `r:${restaurantId}`;
}
export function orderChannel(orderId: string) {
  return `o:${orderId}`;
}

export function emitOrderEvent(evt: OrderEvent) {
  events.emit(restaurantChannel(evt.restaurantId), evt);
  events.emit(orderChannel(evt.orderId), evt);
}

export function subscribeRestaurant(
  restaurantId: string,
  handler: (evt: OrderEvent) => void
): () => void {
  const ch = restaurantChannel(restaurantId);
  events.on(ch, handler);
  return () => events.off(ch, handler);
}

export function subscribeOrder(
  orderId: string,
  handler: (evt: OrderEvent) => void
): () => void {
  const ch = orderChannel(orderId);
  events.on(ch, handler);
  return () => events.off(ch, handler);
}
