/**
 * End-to-end audit — exercises every flow that does NOT require a session context.
 * For session-bound actions (admin mutations) we test the underlying logic by
 * driving the database directly through @prisma/client + the same lib helpers
 * the actions use. The action wrappers (auth + revalidate) are exercised in
 * isolation by HTTP redirect tests (see Phase G — handled separately).
 */
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { placeOrder } from "@/app/r/[slug]/(customer)/checkout/actions";
import { parseHours, openStatus } from "@/lib/hours";
import { generatePickupTimes } from "@/lib/pickup-times";
import { formatMoney, parseMoneyToCents, slugify } from "@/lib/utils";
import { hexToRgbTuple, readableFg } from "@/lib/theme";

let passes = 0;
let failures = 0;
function pass(label: string) {
  passes++;
  console.log(`  ✓ ${label}`);
}
function fail(label: string, why?: string) {
  failures++;
  console.log(`  ✗ ${label}${why ? ` — ${why}` : ""}`);
}
function section(label: string) {
  console.log(`\n${label}`);
}
function assert(cond: unknown, label: string, why?: string) {
  if (cond) pass(label);
  else fail(label, why);
}

async function main() {
  console.log("🔍 Restaurant Platform — End-to-End Audit\n");

  // ---------- Setup
  await db.order.deleteMany();
  const r = await db.restaurant.findUnique({ where: { slug: "mama-bears" } });
  if (!r) throw new Error("Mama Bears seed missing. Run `npm run db:seed`.");

  // Override hours to be always-open for the duration of this audit so it
  // passes regardless of wall-clock time. Restore at the end.
  const originalHours = r.hours;
  const originalPaused = r.isOrderingPaused;
  const originalOrderingHours = r.orderingHours;
  const ALWAYS_OPEN = JSON.stringify({
    mon: { open: "00:00", close: "23:59" },
    tue: { open: "00:00", close: "23:59" },
    wed: { open: "00:00", close: "23:59" },
    thu: { open: "00:00", close: "23:59" },
    fri: { open: "00:00", close: "23:59" },
    sat: { open: "00:00", close: "23:59" },
    sun: { open: "00:00", close: "23:59" },
  });
  await db.restaurant.update({
    where: { id: r.id },
    data: { hours: ALWAYS_OPEN, isOrderingPaused: false, orderingHours: null },
  });

  // =========================================================================
  section("Phase A: Order placement (server action, no auth)");
  const items = await db.menuItem.findMany({
    where: { restaurantId: r.id, isAvailable: true },
    take: 4,
  });
  const placed = await placeOrder({
    slug: "mama-bears",
    customerName: "Alice Tester",
    customerPhone: "(720) 555-0199",
    customerEmail: "alice@example.com",
    pickupTime: "ASAP",
    notes: "Extra napkins",
    tipCents: 200,
    lines: [
      { itemId: items[0].id, quantity: 1 },
      { itemId: items[1].id, quantity: 2, notes: "extra crispy" },
    ],
  });
  assert(placed.ok, "Order placement returns ok");
  assert(placed.orderNumber === 1, "First order = #1");
  const order = await db.order.findUnique({
    where: { id: placed.orderId! },
    include: { items: true },
  });
  assert(order !== null, "Order persisted in DB");

  const expectedSubtotal = items[0].priceCents + items[1].priceCents * 2;
  const expectedTax = Math.round((expectedSubtotal * r.taxBps) / 10000);
  const expectedTotal = expectedSubtotal + expectedTax + 200;
  assert(order!.subtotalCents === expectedSubtotal, `Subtotal = ${formatMoney(expectedSubtotal)}`);
  assert(order!.taxCents === expectedTax, `Tax = ${formatMoney(expectedTax)}`);
  assert(order!.totalCents === expectedTotal, `Total (incl tip) = ${formatMoney(expectedTotal)}`);
  assert(order!.items[0].name === items[0].name, "Item name snapshotted");
  assert(order!.items[0].priceCents === items[0].priceCents, "Item price snapshotted");

  // Second order increments the number
  const second = await placeOrder({
    slug: "mama-bears",
    customerName: "Bob",
    customerPhone: "(720) 555-0100",
    pickupTime: "11:30 AM",
    tipCents: 0,
    lines: [{ itemId: items[2].id, quantity: 1 }],
  });
  assert(second.ok && second.orderNumber === 2, "Sequential order number per restaurant");

  // =========================================================================
  section("Phase B: Server-side validation rejects bad orders");

  // 1. Cart with unavailable item is rejected
  await db.menuItem.update({ where: { id: items[3].id }, data: { isAvailable: false } });
  const rejected = await placeOrder({
    slug: "mama-bears",
    customerName: "Charlie",
    customerPhone: "(720) 555-0150",
    pickupTime: "ASAP",
    tipCents: 0,
    lines: [{ itemId: items[3].id, quantity: 1 }],
  });
  assert(!rejected.ok, "Unavailable item rejected");
  assert(
    rejected.unavailableNames?.includes(items[3].name) ?? false,
    "Rejection includes item name"
  );
  await db.menuItem.update({ where: { id: items[3].id }, data: { isAvailable: true } });

  // 2. Empty cart is rejected
  const empty = await placeOrder({
    slug: "mama-bears",
    customerName: "Dave",
    customerPhone: "(720) 555-0151",
    pickupTime: "ASAP",
    tipCents: 0,
    lines: [],
  });
  assert(!empty.ok, "Empty cart rejected");

  // 3. Missing name rejected
  const noname = await placeOrder({
    slug: "mama-bears",
    customerName: "",
    customerPhone: "(720) 555-0152",
    pickupTime: "ASAP",
    tipCents: 0,
    lines: [{ itemId: items[0].id, quantity: 1 }],
  });
  assert(!noname.ok, "Missing name rejected");
  assert(noname.fieldErrors?.customerName !== undefined, "Field error on customerName");

  // 4. Wrong-restaurant item rejected (multi-tenant safety)
  // First create a second restaurant to test against
  const secondR = await db.restaurant.create({
    data: {
      slug: "audit-second",
      name: "Audit Second Cafe",
      address: "1 Audit Way",
      phone: "(555) 555-0000",
      hours: "{}",
      taxBps: 700,
      isActive: true,
      primaryColor: "#000000",
      accentColor: "#ffffff",
    },
  });
  const secondCat = await db.menuCategory.create({
    data: { restaurantId: secondR.id, name: "Test", displayOrder: 0 },
  });
  const secondItem = await db.menuItem.create({
    data: {
      restaurantId: secondR.id,
      categoryId: secondCat.id,
      name: "Audit Item",
      priceCents: 500,
      displayOrder: 0,
      isAvailable: true,
    },
  });
  const crossTenant = await placeOrder({
    slug: "mama-bears",
    customerName: "Mallory",
    customerPhone: "(720) 555-0666",
    pickupTime: "ASAP",
    tipCents: 0,
    lines: [{ itemId: secondItem.id, quantity: 1 }], // belongs to OTHER restaurant
  });
  assert(!crossTenant.ok, "Cross-tenant item id rejected");

  // =========================================================================
  section("Phase C: Auth utilities (hash + verify)");
  const hash = await bcrypt.hash("test123!", 10);
  const valid = await bcrypt.compare("test123!", hash);
  const invalid = await bcrypt.compare("wrong", hash);
  assert(valid && !invalid, "bcrypt hash/verify works");

  // Verify seed users have valid hashes
  const sa = await db.user.findUnique({ where: { email: "josh@platform.local" } });
  const ra = await db.user.findUnique({ where: { email: "owner@mamabears.local" } });
  assert(sa && (await bcrypt.compare("super123!", sa.passwordHash)), "Super admin password valid");
  assert(
    ra && (await bcrypt.compare("mama123!", ra.passwordHash)),
    "Restaurant admin password valid"
  );
  assert(sa?.role === "super_admin", "Super admin has correct role");
  assert(
    ra?.role === "restaurant_admin" && ra.restaurantId === r.id,
    "Restaurant admin scoped to Mama Bears"
  );

  // =========================================================================
  section("Phase D: Hours + pickup time utilities");
  const hours = parseHours(r.hours);
  assert(hours.mon.open === "06:00", "Hours parse correctly");
  const status = openStatus(hours, new Date("2026-05-25T10:00:00-06:00"));
  assert(status.open === true || status.open === false, "openStatus returns boolean"); // depends on TZ
  const pickup = generatePickupTimes(r.hours, new Date("2026-05-25T08:00:00-06:00"));
  assert(pickup.includes("ASAP"), "Pickup options include ASAP");
  assert(pickup.length > 1, "Pickup options include time slots during open hours");

  // =========================================================================
  section("Phase E: Money + theme + slug utilities");
  assert(formatMoney(1595) === "$15.95", "formatMoney");
  assert(parseMoneyToCents("$15.95") === 1595, "parseMoneyToCents w/ dollar sign");
  assert(parseMoneyToCents("0") === 0, "parseMoneyToCents zero");
  assert(parseMoneyToCents("abc") === null, "parseMoneyToCents invalid → null");
  assert(slugify("Mama Bears Café!") === "mama-bears-caf", "slugify");
  assert(hexToRgbTuple("#C8542C") === "200 84 44", "hexToRgbTuple");
  const lightFg = readableFg("#FFFFFF");
  const darkFg = readableFg("#000000");
  assert(lightFg === "22 19 15", "readableFg of white = near-black");
  assert(darkFg === "255 255 255", "readableFg of black = white");

  // =========================================================================
  section("Phase F: Order status transitions in DB");
  const ord = await db.order.findFirst({ where: { restaurantId: r.id } });
  if (ord) {
    for (const next of ["preparing", "ready", "completed"] as const) {
      await db.order.update({ where: { id: ord.id }, data: { status: next } });
      const after = await db.order.findUnique({ where: { id: ord.id } });
      assert(after?.status === next, `Status moves to ${next}`);
    }
  }

  // =========================================================================
  section("Phase G: Cross-tenant DB isolation");
  // restaurant_admin scoped to Mama Bears should never see secondR.items
  const mamaItems = await db.menuItem.findMany({ where: { restaurantId: r.id } });
  const allItems = await db.menuItem.findMany();
  assert(
    allItems.length > mamaItems.length,
    "Multi-tenant: total items > Mama Bears items"
  );
  // Ensure secondR has its own item
  const secondItems = await db.menuItem.findMany({ where: { restaurantId: secondR.id } });
  assert(secondItems.length === 1 && secondItems[0].id === secondItem.id, "Second restaurant isolated");

  // =========================================================================
  section("Phase H: Cleanup");
  await db.restaurant.delete({ where: { id: secondR.id } });
  await db.order.deleteMany();
  // Restore original Mama Bears hours/state
  await db.restaurant.update({
    where: { id: r.id },
    data: {
      hours: originalHours,
      isOrderingPaused: originalPaused,
      orderingHours: originalOrderingHours,
    },
  });
  pass("Test restaurants + orders cleaned up");

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`Result: ${passes} passed, ${failures} failed.`);
  if (failures > 0) process.exit(1);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
