import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getRestaurantBySlug } from "@/lib/restaurant";
import { generatePickupTimes } from "@/lib/pickup-times";
import { CheckoutClient } from "@/components/restaurant/checkout-client";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const r = await getRestaurantBySlug(slug);
  if (!r) notFound();

  const pickupTimes = generatePickupTimes(r.hours);

  return (
    <div className="bg-surface-50 min-h-[60vh]">
      <CheckoutClient
        slug={r.slug}
        restaurantName={r.name}
        taxBps={r.taxBps}
        pickupTimes={pickupTimes}
      />
    </div>
  );
}
