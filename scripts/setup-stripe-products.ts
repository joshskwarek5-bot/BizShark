/**
 * Creates BizShark's three Stripe products + monthly prices.
 * Run once: `npm run stripe:setup`
 *
 * After running, copy the printed price IDs into .env:
 *   STRIPE_PRICE_STARTER=price_xxx
 *   STRIPE_PRICE_PRO=price_xxx
 *   STRIPE_PRICE_AGENCY=price_xxx
 *
 * NOTE: Your STRIPE_SECRET_KEY must have Products + Prices write scope.
 * Restricted keys may need those permissions added in the Stripe dashboard.
 */

import "dotenv/config";
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("❌  STRIPE_SECRET_KEY is not set in .env");
  process.exit(1);
}

const stripe = new Stripe(key, { apiVersion: "2026-04-22.dahlia" });

const TIERS = [
  { name: "BizShark Starter", env: "STRIPE_PRICE_STARTER", cents: 4900 },
  { name: "BizShark Pro",     env: "STRIPE_PRICE_PRO",     cents: 14900 },
  { name: "BizShark Agency",  env: "STRIPE_PRICE_AGENCY",  cents: 49700 },
] as const;

async function main() {
  console.log("Creating BizShark Stripe products…\n");
  const results: string[] = [];

  for (const tier of TIERS) {
    try {
      const product = await stripe.products.create({
        name: tier.name,
        metadata: { bizshark: "true" },
      });

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: tier.cents,
        currency: "usd",
        recurring: { interval: "month" },
        metadata: { bizshark: "true" },
      });

      const line = `${tier.env}="${price.id}"`;
      results.push(line);
      console.log(`✅  ${tier.name}`);
      console.log(`    Product: ${product.id}`);
      console.log(`    Price:   ${price.id}  ($${tier.cents / 100}/mo)\n`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`❌  Failed to create ${tier.name}: ${msg}`);
      if (msg.includes("does not have permission") || msg.includes("PermissionError")) {
        console.error(
          "\n⚠️  The restricted key may lack Products/Prices write scope.\n" +
          "   Go to https://dashboard.stripe.com/apikeys, edit the key,\n" +
          "   and enable: Products → Write, Prices → Write.\n" +
          "   Or use a standard secret key (sk_live_...) for initial setup.\n"
        );
      }
      process.exit(1);
    }
  }

  console.log("─────────────────────────────────────────");
  console.log("Add these to your .env and Vercel env vars:\n");
  results.forEach((l) => console.log(l));
  console.log("\nDone. Re-deploy after updating env vars so the plan picker activates.");
}

main();
