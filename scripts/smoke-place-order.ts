import { placeOrder } from "@/app/r/[slug]/(customer)/checkout/actions";
import { db } from "@/lib/db";

async function main() {
  const restaurant = await db.restaurant.findUnique({ where: { slug: "mama-bears" } });
  if (!restaurant) throw new Error("Mama Bears not seeded");

  const someItems = await db.menuItem.findMany({
    where: { restaurantId: restaurant.id, isAvailable: true },
    take: 3,
  });
  if (someItems.length < 3) throw new Error("Need at least 3 menu items");

  console.log("📦 Placing test order…");
  const res = await placeOrder({
    slug: "mama-bears",
    customerName: "Test Customer",
    customerPhone: "(720) 555-0100",
    customerEmail: "test@example.com",
    pickupTime: "ASAP",
    notes: "Smoke test — please cancel.",
    tipCents: 0,
    lines: [
      { itemId: someItems[0].id, quantity: 2 },
      { itemId: someItems[1].id, quantity: 1 },
      { itemId: someItems[2].id, quantity: 1, notes: "no onions" },
    ],
  });
  console.log("Result:", res);

  if (!res.ok || !res.orderId) {
    console.error("❌ Order placement failed");
    process.exit(1);
  }

  const order = await db.order.findUnique({
    where: { id: res.orderId },
    include: { items: true },
  });
  console.log("✅ Order in DB:");
  console.log(`   #${order?.orderNumber} · ${order?.customerName} · ${order?.status}`);
  console.log(`   Subtotal: $${(order!.subtotalCents / 100).toFixed(2)}`);
  console.log(`   Tax:      $${(order!.taxCents / 100).toFixed(2)}`);
  console.log(`   Total:    $${(order!.totalCents / 100).toFixed(2)}`);
  console.log(`   Items:    ${order?.items.length}`);
  order?.items.forEach((it) => {
    console.log(`     - ${it.quantity}× ${it.name}  $${(it.priceCents / 100).toFixed(2)}`);
  });
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
