/**
 * Audits the new restaurant ordering controls + revenue PIN flow:
 *   1. canOrderNow respects isOrderingPaused
 *   2. canOrderNow respects orderingHours (separate from physical hours)
 *   3. placeOrder rejects when ordering is closed
 *   4. PIN set → verify happy path + wrong PIN rejection
 */
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { canOrderNow } from "@/lib/ordering";
import { placeOrder } from "@/app/r/[slug]/(customer)/checkout/actions";

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

const ALWAYS_OPEN_HOURS = JSON.stringify({
  mon: { open: "00:00", close: "23:59" },
  tue: { open: "00:00", close: "23:59" },
  wed: { open: "00:00", close: "23:59" },
  thu: { open: "00:00", close: "23:59" },
  fri: { open: "00:00", close: "23:59" },
  sat: { open: "00:00", close: "23:59" },
  sun: { open: "00:00", close: "23:59" },
});

const ALWAYS_CLOSED_HOURS = JSON.stringify({
  mon: { open: "00:00", close: "00:00", closed: true },
  tue: { open: "00:00", close: "00:00", closed: true },
  wed: { open: "00:00", close: "00:00", closed: true },
  thu: { open: "00:00", close: "00:00", closed: true },
  fri: { open: "00:00", close: "00:00", closed: true },
  sat: { open: "00:00", close: "00:00", closed: true },
  sun: { open: "00:00", close: "00:00", closed: true },
});

async function main() {
  console.log("🍔 Ordering Controls + Revenue PIN Audit\n");

  await db.order.deleteMany();
  const r = await db.restaurant.findUnique({ where: { slug: "mama-bears" } });
  if (!r) throw new Error("Mama Bears seed missing. Run npm run db:seed.");

  // Reset to known state
  await db.restaurant.update({
    where: { id: r.id },
    data: {
      isOrderingPaused: false,
      orderingHours: null,
      revenuePinHash: null,
      hours: ALWAYS_OPEN_HOURS,
    },
  });

  section("Phase A: canOrderNow with always-open hours");
  const open = canOrderNow({ isOrderingPaused: false, orderingHours: null, hours: ALWAYS_OPEN_HOURS });
  if (open.ok) pass("Open when hours allow");
  else fail("Should be open", JSON.stringify(open));

  section("Phase B: canOrderNow respects pause toggle");
  const paused = canOrderNow({ isOrderingPaused: true, orderingHours: null, hours: ALWAYS_OPEN_HOURS });
  if (!paused.ok && paused.reason === "paused") pass("Paused → closed with reason='paused'");
  else fail("Pause not respected", JSON.stringify(paused));

  section("Phase C: canOrderNow respects separate ordering hours");
  const sepHoursClosed = canOrderNow({
    isOrderingPaused: false,
    orderingHours: ALWAYS_CLOSED_HOURS,
    hours: ALWAYS_OPEN_HOURS, // physical open but ordering closed
  });
  if (!sepHoursClosed.ok && sepHoursClosed.reason === "closed_today") {
    pass("Separate orderingHours override (closed today)");
  } else {
    fail("Separate hours not applied", JSON.stringify(sepHoursClosed));
  }

  section("Phase D: placeOrder rejects when ordering is closed");
  await db.restaurant.update({
    where: { id: r.id },
    data: { isOrderingPaused: true },
  });
  const items = await db.menuItem.findMany({
    where: { restaurantId: r.id, isAvailable: true },
    take: 1,
  });
  const rej = await placeOrder({
    slug: "mama-bears",
    customerName: "Test",
    customerPhone: "(555) 555-1234",
    pickupTime: "ASAP",
    tipCents: 0,
    lines: [{ itemId: items[0].id, quantity: 1 }],
  });
  if (!rej.ok && rej.error?.toLowerCase().includes("paused")) {
    pass("placeOrder rejects with 'paused' message");
  } else {
    fail("placeOrder should reject when paused", JSON.stringify(rej));
  }
  // restore
  await db.restaurant.update({
    where: { id: r.id },
    data: { isOrderingPaused: false },
  });

  section("Phase E: placeOrder rejects when outside ordering hours");
  await db.restaurant.update({
    where: { id: r.id },
    data: { orderingHours: ALWAYS_CLOSED_HOURS },
  });
  const rej2 = await placeOrder({
    slug: "mama-bears",
    customerName: "Test",
    customerPhone: "(555) 555-1234",
    pickupTime: "ASAP",
    tipCents: 0,
    lines: [{ itemId: items[0].id, quantity: 1 }],
  });
  if (!rej2.ok && rej2.error?.toLowerCase().includes("closed")) {
    pass("placeOrder rejects when ordering hours say closed");
  } else {
    fail("placeOrder should reject when outside hours", JSON.stringify(rej2));
  }
  // restore
  await db.restaurant.update({
    where: { id: r.id },
    data: { orderingHours: null },
  });

  section("Phase F: Revenue PIN — set + verify happy path");
  const correctPin = "1234";
  const hash = await bcrypt.hash(correctPin, 10);
  await db.restaurant.update({ where: { id: r.id }, data: { revenuePinHash: hash } });
  const fresh = await db.restaurant.findUnique({ where: { id: r.id } });
  const correctMatches = await bcrypt.compare(correctPin, fresh!.revenuePinHash!);
  const wrongMatches = await bcrypt.compare("0000", fresh!.revenuePinHash!);
  if (correctMatches) pass("Correct PIN verifies");
  else fail("Correct PIN should verify");
  if (!wrongMatches) pass("Wrong PIN rejected");
  else fail("Wrong PIN should be rejected");

  // Cleanup
  await db.restaurant.update({
    where: { id: r.id },
    data: { revenuePinHash: null, hours: r.hours, isOrderingPaused: false, orderingHours: null },
  });
  await db.order.deleteMany();

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
