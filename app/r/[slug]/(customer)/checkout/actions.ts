"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { emitOrderEvent } from "@/lib/order-events";

const CartLineSchema = z.object({
  itemId: z.string().min(1),
  quantity: z.number().int().positive().max(99),
  notes: z.string().max(280).optional(),
});

const PlaceOrderSchema = z.object({
  slug: z.string().min(1),
  customerName: z.string().min(2, "Please enter your name").max(80),
  customerPhone: z
    .string()
    .min(7, "Please enter a phone number")
    .max(20),
  customerEmail: z
    .string()
    .email("Invalid email")
    .max(120)
    .optional()
    .or(z.literal("")),
  pickupTime: z.string().min(1).max(40),
  notes: z.string().max(500).optional(),
  tipCents: z.number().int().min(0).max(100000).default(0),
  lines: z.array(CartLineSchema).min(1, "Your cart is empty"),
});

export type PlaceOrderInput = z.input<typeof PlaceOrderSchema>;

export interface PlaceOrderResult {
  ok: boolean;
  orderId?: string;
  orderNumber?: number;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  unavailableNames?: string[];
}

export async function placeOrder(raw: PlaceOrderInput): Promise<PlaceOrderResult> {
  const parsed = PlaceOrderSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the errors and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const input = parsed.data;

  const restaurant = await db.restaurant.findUnique({ where: { slug: input.slug } });
  if (!restaurant || !restaurant.isActive) {
    return { ok: false, error: "Restaurant is not accepting orders right now." };
  }

  const itemIds = input.lines.map((l) => l.itemId);
  const items = await db.menuItem.findMany({
    where: { id: { in: itemIds }, restaurantId: restaurant.id },
  });

  if (items.length !== itemIds.length) {
    return {
      ok: false,
      error: "Some items in your cart are no longer available. Please refresh and try again.",
    };
  }

  const unavailable = items.filter((i) => !i.isAvailable);
  if (unavailable.length > 0) {
    return {
      ok: false,
      error: "Some items in your cart are currently unavailable. Please remove them and try again.",
      unavailableNames: unavailable.map((i) => i.name),
    };
  }

  // Build snapshot lines from DB (authoritative pricing)
  const lineMap = new Map(input.lines.map((l) => [l.itemId, l]));
  const orderItemsData = items.map((it) => {
    const cartLine = lineMap.get(it.id)!;
    return {
      menuItemId: it.id,
      name: it.name,
      priceCents: it.priceCents,
      quantity: cartLine.quantity,
      notes: cartLine.notes || null,
    };
  });

  const subtotalCents = orderItemsData.reduce(
    (acc, l) => acc + l.priceCents * l.quantity,
    0
  );
  const taxCents = Math.round((subtotalCents * restaurant.taxBps) / 10000);
  const tipCents = input.tipCents ?? 0;
  const totalCents = subtotalCents + taxCents + tipCents;

  // Create order with sequential per-restaurant order number.
  // SQLite serializes writes, so taking MAX+1 inside an interactive transaction
  // is safe under our single-instance dev setup. For Postgres we'd use a
  // restaurant-scoped sequence or an upsert on a counter row.
  const created = await db.$transaction(async (tx) => {
    const last = await tx.order.findFirst({
      where: { restaurantId: restaurant.id },
      orderBy: { orderNumber: "desc" },
      select: { orderNumber: true },
    });
    const orderNumber = (last?.orderNumber ?? 0) + 1;

    return tx.order.create({
      data: {
        restaurantId: restaurant.id,
        orderNumber,
        customerName: input.customerName.trim(),
        customerPhone: input.customerPhone.trim(),
        customerEmail: input.customerEmail?.trim() || null,
        orderType: "pickup",
        pickupTime: input.pickupTime,
        notes: input.notes?.trim() || null,
        subtotalCents,
        taxCents,
        tipCents,
        totalCents,
        status: "new",
        paymentMethod: "pay_at_pickup",
        paymentStatus: "pending",
        items: { create: orderItemsData },
      },
    });
  });

  emitOrderEvent({
    kind: "created",
    restaurantId: restaurant.id,
    orderId: created.id,
    orderNumber: created.orderNumber,
    status: created.status,
    ts: Date.now(),
  });

  return { ok: true, orderId: created.id, orderNumber: created.orderNumber };
}
