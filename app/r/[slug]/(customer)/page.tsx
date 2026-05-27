import { notFound } from "next/navigation";
import { getRestaurantWithMenu } from "@/lib/restaurant";
import { db } from "@/lib/db";
import { parseHours } from "@/lib/hours";
import { clientTypeMetaFor, parseServices } from "@/lib/client-type";
import { getTemplate } from "@/lib/templates";
import { hasFeature } from "@/lib/features";
import { BUSINESS_TYPES, type BusinessType } from "@/lib/business-types";
import { InquiryForm } from "@/components/restaurant/inquiry-form";
import { BookingWidget } from "@/components/restaurant/booking-widget";
import { parseAppointmentConfig } from "@/lib/availability";
import {
  TeamSection,
  ScheduleSection,
  GallerySection,
  TestimonialsSection,
  FaqSection,
} from "@/components/restaurant/vertical-sections";

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
  const type: BusinessType = (BUSINESS_TYPES as readonly string[]).includes(r.type)
    ? (r.type as BusinessType)
    : "restaurant";
  const meta = clientTypeMetaFor(r.type, r.enabledFeatures);
  const previewId = sp.previewTemplate ?? null;
  const T = getTemplate(previewId ?? r.templateId);
  const { Hero, FeaturedStrip, ServicesSection, AboutSection, VisitCard } = T.components;

  const showMenu = hasFeature(type, r.enabledFeatures, "menu");
  const showServices = hasFeature(type, r.enabledFeatures, "services_list");
  const showQuote = hasFeature(type, r.enabledFeatures, "quote_request");
  const showAppointment = hasFeature(type, r.enabledFeatures, "appointment_request");
  const showContact = hasFeature(type, r.enabledFeatures, "contact_form");
  const showGallery = hasFeature(type, r.enabledFeatures, "gallery");
  const showTestimonials = hasFeature(type, r.enabledFeatures, "testimonials");

  // Fetch the new vertical entities — only the ones we'll render
  const [staffRows, classRows, galleryRows, testimonialRows, faqRows] =
    await Promise.all([
      db.staff.findMany({
        where: { restaurantId: r.id, isActive: true },
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
      }),
      type === "fitness"
        ? db.classSession.findMany({
            where: { restaurantId: r.id, isActive: true },
            orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
          })
        : Promise.resolve([]),
      showGallery
        ? db.galleryImage.findMany({
            where: { restaurantId: r.id, isActive: true },
            orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
            take: 24,
          })
        : Promise.resolve([]),
      showTestimonials
        ? db.testimonial.findMany({
            where: { restaurantId: r.id, isActive: true },
            orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
            take: 6,
          })
        : Promise.resolve([]),
      db.faq.findMany({
        where: { restaurantId: r.id, isActive: true },
        orderBy: [{ displayOrder: "asc" }],
        take: 12,
      }),
    ]);

  const instructorById = new Map(staffRows.map((s) => [s.id, s.name]));

  const featured = showMenu
    ? r.categories
        .flatMap((c) => c.items.filter((i) => i.isAvailable).slice(0, 1))
        .slice(0, 3)
    : [];
  const services = showServices ? parseServices(r.services) : [];
  const serviceNames = services.map((s) => s.name).filter(Boolean);

  // Primary CTA: route to whichever feature makes most sense for the type.
  let primaryCtaHref = `tel:${r.phone.replace(/[^\d+]/g, "")}`;
  if (showMenu) primaryCtaHref = `/r/${r.slug}/menu`;
  else if (type === "fitness" && classRows.length > 0) primaryCtaHref = "#schedule";
  else if (showAppointment) primaryCtaHref = "#appointment";
  else if (showQuote) primaryCtaHref = "#quote";
  else if (showContact) primaryCtaHref = "#contact";

  // Section order: vertical-aware
  // Restaurant: about → menu → contact → visit
  // Salon (personal_service): about → services → team → gallery → reviews → book → visit
  // Gym (fitness): about → schedule → team → memberships(soon) → reviews → trial → visit
  // Trade: about → services → gallery (before/after) → reviews → quote → visit
  // Healthcare: about → services → providers → reviews → appointment → visit
  // Professional: about → services → team → reviews → quote → visit
  // Retail: about → gallery → reviews → contact → visit

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
        primaryCtaHref={primaryCtaHref}
      />

      {r.aboutCopy && <AboutSection copy={r.aboutCopy} />}

      {/* Restaurant menu featured strip */}
      {showMenu && featured.length > 0 && (
        <FeaturedStrip slug={r.slug} items={featured} />
      )}

      {/* Services list — for everyone except restaurants */}
      {showServices && services.length > 0 && (
        <ServicesSection services={services} phone={r.phone} />
      )}

      {/* Fitness: class schedule */}
      {type === "fitness" && classRows.length > 0 && (
        <ScheduleSection
          classes={classRows.map((c) => ({
            id: c.id,
            name: c.name,
            description: c.description,
            dayOfWeek: c.dayOfWeek,
            startTime: c.startTime,
            endTime: c.endTime,
            instructorName: c.instructorId
              ? instructorById.get(c.instructorId) ?? null
              : null,
            capacity: c.capacity,
            level: c.level,
            bookingUrl: c.bookingUrl,
          }))}
          heading="Class schedule"
          subhead="Show up, sweat, leave taller."
        />
      )}

      {/* Team grid — salon / healthcare / fitness / professional */}
      {staffRows.length > 0 && (
        <TeamSection
          staff={staffRows.map((s) => ({
            id: s.id,
            name: s.name,
            title: s.title,
            bio: s.bio,
            photoUrl: s.photoUrl,
            specialties: safeParseStrings(s.specialties),
            bookingUrl: s.bookingUrl,
            instagram: s.instagram,
            yearsExperience: s.yearsExperience,
          }))}
          heading={
            type === "healthcare"
              ? "Meet your providers"
              : type === "fitness"
                ? "Your coaches"
                : type === "professional_service"
                  ? "The team"
                  : "Meet the team"
          }
          subhead={
            type === "personal_service"
              ? "Pick your person — every stylist's got their own thing."
              : undefined
          }
        />
      )}

      {/* Gallery */}
      {showGallery && galleryRows.length > 0 && (
        <GallerySection
          images={galleryRows.map((i) => ({
            id: i.id,
            imageUrl: i.imageUrl,
            caption: i.caption,
            tag: i.tag,
          }))}
          heading={type === "trade_service" ? "Recent work" : "Gallery"}
          subhead={
            type === "trade_service"
              ? "Before-and-afters from real jobs — no stock photos."
              : type === "personal_service"
                ? "Real client work from our chairs."
                : undefined
          }
        />
      )}

      {/* Testimonials */}
      {showTestimonials && testimonialRows.length > 0 && (
        <TestimonialsSection
          items={testimonialRows.map((t) => ({
            id: t.id,
            quote: t.quote,
            author: t.author,
            rating: t.rating,
            source: t.source,
          }))}
        />
      )}

      {/* FAQs — useful for healthcare/professional/trade */}
      {faqRows.length > 0 && (
        <FaqSection
          items={faqRows.map((f) => ({
            id: f.id,
            question: f.question,
            answer: f.answer,
          }))}
        />
      )}

      {/* Conversion forms */}
      {showQuote && (
        <InquiryForm slug={r.slug} kind="quote" serviceNames={serviceNames} />
      )}
      {showAppointment && (
        (() => {
          const bookingCfg = parseAppointmentConfig(r.appointmentConfig);
          if (bookingCfg.enabled) {
            return (
              <BookingWidget
                slug={r.slug}
                businessName={r.name}
                services={services.map((s) => ({
                  id: s.id,
                  name: s.name,
                  duration: s.duration ?? null,
                  priceCents: s.priceCents ?? null,
                }))}
                maxDaysAhead={bookingCfg.maxDaysAhead}
              />
            );
          }
          // Fallback to the free-form "request an appointment" form when
          // real slot booking isn't configured yet
          return (
            <InquiryForm
              slug={r.slug}
              kind="appointment"
              serviceNames={serviceNames}
            />
          );
        })()
      )}
      {showContact && !showQuote && !showAppointment && (
        <InquiryForm slug={r.slug} kind="contact" />
      )}

      <VisitCard restaurant={r} />
    </>
  );
}

function safeParseStrings(raw: string): string[] {
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
