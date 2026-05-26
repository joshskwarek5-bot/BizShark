import { notFound } from "next/navigation";
import { getRestaurantWithMenu } from "@/lib/restaurant";
import { parseHours } from "@/lib/hours";
import { clientTypeMeta, parseServices } from "@/lib/client-type";
import { getTemplate } from "@/lib/templates";

export default async function RestaurantHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ previewTemplate?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const r = await getRestaurantWithMenu(slug);
  if (!r) notFound();
  const meta = clientTypeMeta(r.type);
  // ?previewTemplate=<id> lets the operator preview any template without
  // changing the restaurant's persisted templateId. Falls back to the stored
  // template if the query is missing or unknown.
  const previewId = sp.previewTemplate ?? null;
  const T = getTemplate(previewId ?? r.templateId);
  const { Hero, FeaturedStrip, ServicesSection, AboutSection, VisitCard } = T.components;

  // Restaurant favorites — first item from each of the first 3 categories
  const featured = meta.hasMenu
    ? r.categories
        .flatMap((c) => c.items.filter((i) => i.isAvailable).slice(0, 1))
        .slice(0, 3)
    : [];

  const services = meta.hasServices ? parseServices(r.services) : [];

  return (
    <>
      {previewId && (
        <div className="bg-amber-100 text-amber-900 text-xs px-4 py-2 text-center border-b border-amber-200">
          <span className="font-medium">Preview mode</span> — viewing the{" "}
          <span className="font-mono">{T.label}</span> template. The live site is
          unchanged.
        </div>
      )}
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
