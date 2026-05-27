import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/auth";
import { TourClient } from "@/components/operator/tour-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tour mode" };

export default async function TourPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const auth = await requireOperator();
  if (!auth.authorized) redirect("/login");

  const restaurant = await db.restaurant.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      operatorId: true,
      type: true,
      stripeAccountStatus: true,
      _count: { select: { items: true } },
    },
  });
  if (!restaurant) notFound();
  if (restaurant.operatorId !== auth.operator.id) notFound();

  return (
    <TourClient
      slug={slug}
      restaurantName={restaurant.name}
      stripeStatus={restaurant.stripeAccountStatus}
      menuItemCount={restaurant._count.items}
    />
  );
}
