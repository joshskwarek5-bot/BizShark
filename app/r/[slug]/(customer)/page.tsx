import { notFound } from "next/navigation";
import { getRestaurantWithMenu } from "@/lib/restaurant";
import { parseHours } from "@/lib/hours";
import { clientTypeMeta, parseServices } from "@/lib/client-type";
import { Hero } from "@/components/restaurant/hero";
import { FeaturedStrip } from "@/components/restaurant/featured-strip";
import { ServicesSection } from "@/components/restaurant/services-section";
import { AboutSection } from "@/components/restaurant/about-section";
import { VisitCard } from "@/components/restaurant/visit-card";

export default async function RestaurantHomePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const r = await getRestaurantWithMenu(slug);
  if (!r) notFound();
  const meta = clientTypeMeta(r.type);

  // Restaurant favorites — first item from each of the first 3 categories
  const featured = meta.hasMenu
    ? r.categories
        .flatMap((c) => c.items.filter((i) => i.isAvailable).slice(0, 1))
        .slice(0, 3)
    : [];

  const services = meta.hasServices ? parseServices(r.services) : [];

  return (
    <>
      <Hero
        slug={r.slug}
        name={r.name}
        tagline={r.tagline}
        heroHeadline={r.heroHeadline}
        heroSubhead={r.heroSubhead}
        heroImageUrl={r.heroImageUrl}
        address={r.address}
        city={r.city}
        state={r.state}
        hours={parseHours(r.hours)}
        primaryCtaLabel={meta.primaryCta}
        primaryCtaHref={meta.hasMenu ? `/r/${r.slug}/menu` : `tel:${r.phone.replace(/[^\d+]/g, "")}`}
      />
      {r.aboutCopy && <AboutSection copy={r.aboutCopy} />}
      {meta.hasMenu && featured.length > 0 && <FeaturedStrip slug={r.slug} items={featured} />}
      {meta.hasServices && <ServicesSection services={services} phone={r.phone} />}
      <VisitCard restaurant={r} />
    </>
  );
}
