import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getRestaurantBySlug } from "@/lib/restaurant";
import { generatePickupTimes } from "@/lib/pickup-times";
import { canOrderNow } from "@/lib/ordering";
import { isStripeConfigured, publishableKey as stripePublishableKey } from "@/lib/stripe";
import { CheckoutClient } from "@/components/restaurant/checkout-client";
import { OrderingBanner } from "@/components/restaurant/ordering-banner";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const r = await getRestaurantBySlug(slug);
  if (!r) notFound();

  const pickupTimes = generatePickupTimes(r.orderingHours ?? r.hours);
  const ordering = canOrderNow(r);
  const pubKey = stripePublishableKey();
  const cardEnabled =
    isStripeConfigured() &&
    !!pubKey &&
    !!r.stripeAccountId &&
    r.stripeChargesEnabled;

  return (
    <div className="bg-surface-50 min-h-[60vh]">
      <OrderingBanner status={ordering} phone={r.phone} slug={r.slug} />
      <CheckoutClient
        slug={r.slug}
        restaurantName={r.name}
        taxBps={r.taxBps}
        pickupTimes={pickupTimes}
        orderingOpen={ordering.ok}
        cardEnabled={cardEnabled}
        publishableKey={cardEnabled ? pubKey : null}
        stripeAccountId={cardEnabled ? r.stripeAccountId : null}
      />
    </div>
  );
}
