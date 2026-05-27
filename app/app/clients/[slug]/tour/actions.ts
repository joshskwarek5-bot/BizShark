"use server";

// Tour-mode actions for the operator's walk-in demo.
//
// placeTestOrder — picks the first available menu item from the restaurant
// and places a pay-at-pickup order through the SAME pipeline a real
// customer would use. The order pops up in the kitchen view (live order
// feed) within ~1 second so the operator can prove "this is what happens
// when a real customer hits Order Online."
//
// clearTestOrders — wipes any orders tagged "TOUR DEMO" so the kitchen
// queue stays clean for real traffic after the pitch.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/auth";
import { emitOrderEvent } from "@/lib/order-events";

const TOUR_TAG = "TOUR DEMO";

async function ensureOwnedRestaurant(slug: string) {
  const auth = await requireOperator();
  if (!auth.authorized) throw new Error(auth.reason);
  const r = await db.restaurant.findUnique({ where: { slug } });
  if (!r) throw new Error("not_found");
  if (r.operatorId !== auth.operator.id) throw new Error("forbidden");
  return { operator: auth.operator, restaurant: r };
}

export interface TestOrderResult {
  ok: true;
  orderId: string;
  orderNumber: number;
  itemsPlaced: number;
  totalCents: number;
  kitchenUrl: string;
  publicUrl: string;
}
export interface TestOrderFailure {
  ok: false;
  error: string;
}

export async function placeTestOrder(input: {
  slug: string;
}): Promise<TestOrderResult | TestOrderFailure> {
  const { slug } = z.object({ slug: z.string() }).parse(input);
  let context;
  try {
    context = await ensureOwnedRestaurant(slug);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Not authorized" };
  }
  const { restaurant } = context;

  // Pick the first 1-3 available menu items so the kitchen view shows a
  // realistic order, not just a single bagel.
  const items = await db.menuItem.findMany({
    where: { restaurantId: restaurant.id, isAvailable: true },
    orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
    take: 3,
  });
  if (items.length === 0) {
    return {
      ok: false,
      error:
        "No available menu items yet — import a menu first, then come back.",
    };
  }

  // Next order number for this restaurant
  const lastOrderAgg = await db.order.aggregate({
    where: { restaurantId: restaurant.id },
    _max: { orderNumber: true },
  });
  const orderNumber = (lastOrderAgg._max.orderNumber ?? 0) + 1;

  const orderItemsData = items.map((it) => ({
    menuItemId: it.id,
    name: it.name,
    priceCents: it.priceCents,
    quantity: 1,
    notes: null as string | null,
  }));
  const subtotalCents = orderItemsData.reduce(
    (acc, l) => acc + l.priceCents * l.quantity,
    0
  );
  const taxCents = Math.round(subtotalCents * (restaurant.taxBps / 10_000));
  const totalCents = subtotalCents + taxCents;

  try {
    const order = await db.order.create({
      data: {
        restaurantId: restaurant.id,
        orderNumber,
        customerName: "Tour Demo (operator)",
        customerPhone: "(555) 010-1010",
        customerEmail: null,
        orderType: "pickup",
        pickupTime: "ASAP",
        notes: `${TOUR_TAG} — placed by operator from tour mode. Delete after demo.`,
        subtotalCents,
        taxCents,
        tipCents: 0,
        totalCents,
        status: "new",
        paymentMethod: "pay_at_pickup",
        paymentStatus: "pending",
        items: { create: orderItemsData },
      },
    });

    // Same event the real customer flow emits → live order feed picks it up
    emitOrderEvent({
      kind: "created",
      restaurantId: restaurant.id,
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      ts: Date.now(),
    });

    revalidatePath(`/r/${slug}/admin`);
    revalidatePath(`/r/${slug}/admin/orders`);

    return {
      ok: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      itemsPlaced: items.length,
      totalCents,
      kitchenUrl: `/r/${slug}/admin`,
      publicUrl: `/r/${slug}`,
    };
  } catch (e) {
    console.error("[tour] placeTestOrder failed", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not create test order",
    };
  }
}

export async function clearTestOrders(input: {
  slug: string;
}): Promise<{ ok: true; deleted: number } | { ok: false; error: string }> {
  const { slug } = z.object({ slug: z.string() }).parse(input);
  let context;
  try {
    context = await ensureOwnedRestaurant(slug);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Not authorized" };
  }
  const { restaurant } = context;

  // Delete any order tagged TOUR DEMO. OrderItems cascade.
  const result = await db.order.deleteMany({
    where: {
      restaurantId: restaurant.id,
      notes: { contains: TOUR_TAG },
    },
  });
  revalidatePath(`/r/${slug}/admin`);
  revalidatePath(`/r/${slug}/admin/orders`);
  return { ok: true, deleted: result.count };
}
