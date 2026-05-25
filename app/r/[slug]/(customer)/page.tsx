import { notFound } from "next/navigation";
import { getRestaurantWithMenu } from "@/lib/restaurant";
import { parseHours } from "@/lib/hours";
import { Hero } from "@/components/restaurant/hero";
import { FeaturedStrip } from "@/components/restaurant/featured-strip";
import { VisitCard } from "@/components/restaurant/visit-card";

export default async function RestaurantHomePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const r = await getRestaurantWithMenu(slug);
  if (!r) notFound();

  // Surface a few favorites — first item from each of the first 3 categories
  const featured = r.categories
    .flatMap((c) => c.items.filter((i) => i.isAvailable).slice(0, 1))
    .slice(0, 3);

  return (
    <>
      <Hero
        slug={r.slug}
        name={r.name}
        tagline={r.tagline}
        heroImageUrl={r.heroImageUrl}
        address={r.address}
        city={r.city}
        state={r.state}
        hours={parseHours(r.hours)}
      />
      <FeaturedStrip slug={r.slug} items={featured} />
      <VisitCard restaurant={r} />
    </>
  );
}
