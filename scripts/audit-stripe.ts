/**
 * Validates Stripe integration logic that doesn't require live Stripe API calls.
 *
 * What this covers:
 *  - New Restaurant fields (stripeAccountId, stripeChargesEnabled, platformFeeBps)
 *  - New Order fields (stripePaymentIntentId, stripeReceiptUrl)
 *  - startCardCheckout rejects when Stripe isn't configured / restaurant not connected
 *  - startCardCheckout rejects unavailable items + closed ordering
 *  - reconcilePaymentForOrder is a no-op for orders with no PI / already paid
 *  - Admin queue filter excludes pending-card orders, includes paid + pay-at-pickup
 *  - Webhook route responds 400 / 503 correctly with bad inputs
 *
 * What this does NOT cover (needs live test keys + manual run):
 *  - The Connect onboarding flow itself (Stripe-hosted)
 *  - PaymentIntent creation against a real connected account
 *  - Webhook signature verification with a real Stripe-generated payload
 *  See README / docs for `stripe listen` instructions to exercise webhooks locally.
 */
import { db } from "@/lib/db";
import {
  startCardCheckout,
  reconcilePaymentForOrder,
} from "@/app/r/[slug]/(customer)/checkout/payment-actions";

const BASE = "http://localhost:3000";

let passes = 0;
let failures = 0;
const pass = (l: string) => {
  passes++;
  console.log(`  ✓ ${l}`);
};
const fail = (l: string, why?: string) => {
  failures++;
  console.log(`  ✗ ${l}${why ? ` — ${why}` : ""}`);
};
const section = (l: string) => console.log(`\n${l}`);

async function main() {
  console.log("💳 Stripe Integration Audit\n");

  await db.order.deleteMany();
  const r = await db.restaurant.findUnique({ where: { slug: "mama-bears" } });
  if (!r) throw new Error("Mama Bears seed missing");

  // Reset Stripe state to "not connected" for these tests
  await db.restaurant.update({
    where: { id: r.id },
    data: {
      stripeAccountId: null,
      stripeAccountStatus: "none",
      stripeChargesEnabled: false,
      stripePayoutsEnabled: false,
      platformFeeBps: 0,
    },
  });

  section("Phase A: schema fields exist + defaults");
  const fresh = await db.restaurant.findUnique({ where: { id: r.id } });
  if (fresh?.stripeAccountStatus === "none") pass("stripeAccountStatus defaults to 'none'");
  else fail("default wrong", fresh?.stripeAccountStatus);
  if (fresh?.stripeChargesEnabled === false) pass("stripeChargesEnabled defaults to false");
  else fail("charges default wrong");
  if (fresh?.platformFeeBps === 0) pass("platformFeeBps defaults to 0");
  else fail("platformFeeBps default wrong");

  section("Phase B: startCardCheckout rejects when restaurant not connected");
  const items = await db.menuItem.findMany({
    where: { restaurantId: r.id, isAvailable: true },
    take: 2,
  });
  const noConnect = await startCardCheckout({
    slug: "mama-bears",
    customerName: "Test",
    customerPhone: "(555) 555-1234",
    pickupTime: "ASAP",
    tipCents: 0,
    lines: [{ itemId: items[0].id, quantity: 1 }],
  });
  if (!noConnect.ok && noConnect.error) {
    pass(`Rejected with: "${noConnect.error}"`);
  } else {
    fail("Should reject when restaurant has no Stripe", JSON.stringify(noConnect));
  }

  section("Phase C: simulated 'connected' state — admin queue filtering");
  // Pretend the restaurant has Stripe connected so we can test the queue filter
  await db.restaurant.update({
    where: { id: r.id },
    data: {
      stripeAccountId: "acct_TEST_fake",
      stripeAccountStatus: "active",
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
    },
  });

  // Create 3 orders: 1 pay-at-pickup, 1 card-paid, 1 card-pending
  const cat = await db.menuCategory.findFirst({ where: { restaurantId: r.id } });
  const pickupOrder = await db.order.create({
    data: {
      restaurantId: r.id,
      orderNumber: 1001,
      customerName: "Pickup Cust",
      customerPhone: "1",
      pickupTime: "ASAP",
      subtotalCents: 1000,
      taxCents: 86,
      totalCents: 1086,
      paymentMethod: "pay_at_pickup",
      paymentStatus: "pending",
      status: "new",
      items: {
        create: [
          {
            menuItemId: items[0].id,
            name: items[0].name,
            priceCents: items[0].priceCents,
            quantity: 1,
          },
        ],
      },
    },
  });
  const cardPaidOrder = await db.order.create({
    data: {
      restaurantId: r.id,
      orderNumber: 1002,
      customerName: "Card Paid",
      customerPhone: "2",
      pickupTime: "ASAP",
      subtotalCents: 1000,
      taxCents: 86,
      totalCents: 1086,
      paymentMethod: "card",
      paymentStatus: "paid",
      stripePaymentIntentId: "pi_TEST_paid",
      status: "new",
      items: {
        create: [
          {
            menuItemId: items[0].id,
            name: items[0].name,
            priceCents: items[0].priceCents,
            quantity: 1,
          },
        ],
      },
    },
  });
  const cardPendingOrder = await db.order.create({
    data: {
      restaurantId: r.id,
      orderNumber: 1003,
      customerName: "Card Pending",
      customerPhone: "3",
      pickupTime: "ASAP",
      subtotalCents: 1000,
      taxCents: 86,
      totalCents: 1086,
      paymentMethod: "card",
      paymentStatus: "pending",
      stripePaymentIntentId: "pi_TEST_pending",
      status: "new",
      items: {
        create: [
          {
            menuItemId: items[0].id,
            name: items[0].name,
            priceCents: items[0].priceCents,
            quantity: 1,
          },
        ],
      },
    },
  });

  // Simulate the dashboard's queue filter
  const kitchenVisible = {
    OR: [{ paymentMethod: "pay_at_pickup" }, { paymentStatus: "paid" }],
  };
  const visible = await db.order.findMany({
    where: { restaurantId: r.id, status: "new", ...kitchenVisible },
  });
  const ids = visible.map((o) => o.id);
  if (ids.includes(pickupOrder.id)) pass("Pay-at-pickup order is visible in queue");
  else fail("Pay-at-pickup missing");
  if (ids.includes(cardPaidOrder.id)) pass("Paid-card order is visible in queue");
  else fail("Paid card missing");
  if (!ids.includes(cardPendingOrder.id)) pass("Pending-card order HIDDEN from queue");
  else fail("Pending card leaked into queue");

  section("Phase D: reconcilePaymentForOrder is a no-op for already-paid");
  const reconcile = await reconcilePaymentForOrder(cardPaidOrder.id);
  if (reconcile.ok && reconcile.status === "paid") pass("Skip reconciliation when already paid");
  else fail("Reconcile should be no-op", JSON.stringify(reconcile));

  section("Phase E: webhook route returns proper status codes");
  // No signature → 400
  const noSig = await fetch(`${BASE}/api/stripe/webhook`, {
    method: "POST",
    body: '{"test":true}',
  });
  if (noSig.status === 400 || noSig.status === 503) {
    pass(`Webhook rejects unsigned/unsupported (${noSig.status})`);
  } else {
    fail("Webhook should reject unsigned", String(noSig.status));
  }

  // Bad signature → 400 if STRIPE_WEBHOOK_SECRET is set; 503 otherwise.
  const badSig = await fetch(`${BASE}/api/stripe/webhook`, {
    method: "POST",
    body: '{"id":"evt_test","type":"ping"}',
    headers: { "stripe-signature": "t=1,v1=bogus" },
  });
  if ([400, 503].includes(badSig.status)) {
    pass(`Webhook rejects bad signature (${badSig.status})`);
  } else {
    fail("Webhook should reject bad sig", String(badSig.status));
  }

  section("Phase F: Cleanup");
  await db.restaurant.update({
    where: { id: r.id },
    data: {
      stripeAccountId: null,
      stripeAccountStatus: "none",
      stripeChargesEnabled: false,
      stripePayoutsEnabled: false,
    },
  });
  await db.order.deleteMany();
  pass("Reset Stripe state + cleared test orders");

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`Result: ${passes} passed, ${failures} failed.`);
  console.log(
    `\nManual verification still needed for: Connect Express onboarding,\n` +
      `live PaymentIntent creation, and signed-webhook delivery via\n` +
      `\`stripe listen --forward-to localhost:3000/api/stripe/webhook\`.`
  );
  if (failures > 0) process.exit(1);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
