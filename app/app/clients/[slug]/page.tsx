import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  ExternalLink,
  Settings,
  CreditCard,
  Send,
  Inbox,
  ChefHat,
  Receipt,
  Globe,
  Sparkles,
  Rocket,
} from "lucide-react";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/auth";
import { clientTypeMetaFor } from "@/lib/client-type";
import { EnrichCard } from "@/components/operator/enrich-card";
import { AutoBuildCard } from "@/components/operator/auto-build-card";
import { RestaurantStripeCard } from "@/components/operator/restaurant-stripe-card";
import {
  RestaurantReadinessCard,
  type ReadinessSnapshot,
} from "@/components/operator/restaurant-readiness-card";
import { parseHours } from "@/lib/hours";

export const dynamic = "force-dynamic";
export const metadata = { title: "Client" };

export default async function OperatorClientOverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const auth = await requireOperator();
  if (!auth.authorized) redirect("/login");
  const { operator } = auth;

  const restaurant = await db.restaurant.findUnique({
    where: { slug },
    include: {
      _count: {
        select: { items: true, orders: true, categories: true, inquiries: true },
      },
      billing: { select: { mode: true, status: true, amountCents: true } },
    },
  });
  if (!restaurant) notFound();
  if (restaurant.operatorId !== operator.id) notFound();

  const [openInvoices, newInquiries] = await Promise.all([
    db.clientInvoice.count({
      where: { restaurantId: restaurant.id, status: { in: ["open", "draft"] } },
    }),
    db.inquiry.count({
      where: { restaurantId: restaurant.id, status: "new" },
    }),
  ]);

  // Readiness signals — derived from the restaurant row + counts. Cheap.
  const hoursParsed = parseHours(restaurant.hours);
  const hoursOpenAnyDay = Object.values(hoursParsed).some((d) => !d.closed);
  const readiness: ReadinessSnapshot = {
    hasHero: !!restaurant.heroImageUrl,
    hasLogo: !!restaurant.logoUrl,
    menuItemCount: restaurant._count.items,
    hasCategories: restaurant._count.categories > 0,
    stripeStatus: restaurant.stripeAccountStatus,
    stripeChargesEnabled: restaurant.stripeChargesEnabled,
    hasPhone: !!restaurant.phone?.trim(),
    hasEmail: !!restaurant.email?.trim(),
    hasAddress: !!restaurant.address?.trim(),
    hasHoursSet: hoursOpenAnyDay,
    hasOrders: restaurant._count.orders > 0,
  };

  const meta = clientTypeMetaFor(restaurant.type, restaurant.enabledFeatures);

  const quickLinks = [
    {
      href: `/r/${restaurant.slug}/admin`,
      label: meta.hasMenu ? "Orders" : "Overview",
      icon: meta.hasMenu ? Receipt : Globe,
      tone: "default" as const,
      badge: null,
    },
    {
      href: `/r/${restaurant.slug}/admin/menu`,
      label: meta.hasMenu ? "Menu" : "Services",
      icon: ChefHat,
      tone: "default" as const,
      badge: restaurant._count.items > 0 ? restaurant._count.items : null,
      hide: !meta.hasMenu && !meta.hasServices,
    },
    {
      href: `/r/${restaurant.slug}/admin/settings`,
      label: "Settings & branding",
      icon: Settings,
      tone: "default" as const,
      badge: null,
    },
    {
      href: `/r/${restaurant.slug}/admin/inquiries`,
      label: "Inquiries",
      icon: Inbox,
      tone: newInquiries > 0 ? ("sky" as const) : ("default" as const),
      badge: newInquiries > 0 ? newInquiries : null,
      hide: restaurant._count.inquiries === 0 && newInquiries === 0,
    },
    {
      href: `/app/clients/${restaurant.slug}/billing`,
      label: "Billing",
      icon: CreditCard,
      tone: openInvoices > 0 ? ("brand" as const) : ("default" as const),
      badge: openInvoices > 0 ? openInvoices : null,
    },
    {
      href: `/app/clients/${restaurant.slug}/handoff`,
      label: "Hand off",
      icon: Send,
      tone: "default" as const,
      badge: null,
    },
    {
      href: `/app/clients/${restaurant.slug}/tour`,
      label: "Tour mode",
      icon: Rocket,
      tone: "brand" as const,
      badge: null,
    },
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-8 max-w-5xl">
      <Link
        href="/app/clients"
        className="inline-flex items-center gap-1.5 text-sm text-surface-600 hover:text-brand mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> All clients
      </Link>

      {/* Hero card with hero image + name + quick public link */}
      <section className="rounded-3xl overflow-hidden border border-surface-200 bg-white shadow-soft mb-6">
        <div className="relative aspect-[3/1] bg-gradient-to-br from-surface-100 to-surface-200">
          {restaurant.heroImageUrl ? (
            <Image
              src={restaurant.heroImageUrl}
              alt={restaurant.name}
              fill
              sizes="(max-width: 768px) 100vw, 960px"
              className="object-cover"
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(135deg, ${restaurant.primaryColor}, ${restaurant.accentColor})`,
              }}
            />
          )}
        </div>
        <div className="p-6 md:p-8 flex items-end justify-between gap-4 flex-wrap -mt-2">
          <div className="min-w-0">
            <div className="text-xs font-mono uppercase tracking-widest text-brand">
              {meta.label}
            </div>
            <h1 className="mt-1 font-display text-3xl text-surface-900 truncate">
              {restaurant.name}
            </h1>
            <p className="mt-1 text-sm text-surface-500 truncate">
              {restaurant.address}
              {restaurant.city ? `, ${restaurant.city}` : ""}
              {restaurant.state ? `, ${restaurant.state}` : ""}
            </p>
          </div>
          <Link
            href={`/r/${restaurant.slug}`}
            target="_blank"
            className="inline-flex h-11 items-center gap-1.5 rounded-full bg-brand text-brand-fg px-5 text-sm font-medium shadow-soft hover:brightness-105 transition shrink-0"
          >
            View public site <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>

      {/* Quick actions grid */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {quickLinks
          .filter((l) => !("hide" in l) || !l.hide)
          .map((l) => {
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`relative rounded-2xl border bg-white p-5 shadow-soft hover:shadow-elevated transition ${
                  l.tone === "brand"
                    ? "border-brand/30"
                    : l.tone === "sky"
                      ? "border-sky-200"
                      : "border-surface-200"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div
                    className={`h-10 w-10 grid place-items-center rounded-full ${
                      l.tone === "brand"
                        ? "bg-brand/10 text-brand"
                        : l.tone === "sky"
                          ? "bg-sky-100 text-sky-700"
                          : "bg-surface-100 text-surface-700"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  {l.badge !== null && l.badge !== undefined && (
                    <span
                      className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-[11px] font-semibold ${
                        l.tone === "brand"
                          ? "bg-brand text-brand-fg"
                          : l.tone === "sky"
                            ? "bg-sky-500 text-white"
                            : "bg-surface-200 text-surface-700"
                      }`}
                    >
                      {l.badge}
                    </span>
                  )}
                </div>
                <div className="text-sm font-medium text-surface-900">{l.label}</div>
              </Link>
            );
          })}
      </section>

      {/* Stats strip */}
      <section className="grid sm:grid-cols-4 gap-3 mb-6">
        <Stat
          label={meta.hasMenu ? "Menu items" : "Services"}
          value={String(restaurant._count.items)}
        />
        {meta.hasMenu && (
          <Stat label="Categories" value={String(restaurant._count.categories)} />
        )}
        {meta.hasMenu && (
          <Stat label="Orders" value={String(restaurant._count.orders)} />
        )}
        <Stat
          label="Billing"
          value={
            restaurant.billing
              ? restaurant.billing.mode === "monthly"
                ? `${restaurant.billing.amountCents ? "$" + (restaurant.billing.amountCents / 100).toFixed(0) : "—"}/mo`
                : restaurant.billing.mode === "revenue_share"
                  ? "% of sales"
                  : "One-time"
              : "Not set"
          }
        />
      </section>

      {/* Readiness scorecard — is this restaurant ready to pitch? */}
      <div className="mb-6">
        <RestaurantReadinessCard
          slug={restaurant.slug}
          restaurantName={restaurant.name}
          snapshot={readiness}
        />
      </div>

      {/* Operator-side Stripe Connect setup */}
      <div className="mb-6" id="stripe-card">
        <RestaurantStripeCard
          slug={restaurant.slug}
          restaurantName={restaurant.name}
          restaurantEmail={restaurant.email}
          initial={{
            stripeAccountId: restaurant.stripeAccountId,
            stripeAccountStatus: restaurant.stripeAccountStatus,
            stripeChargesEnabled: restaurant.stripeChargesEnabled,
            stripePayoutsEnabled: restaurant.stripePayoutsEnabled,
            platformFeeBps: restaurant.platformFeeBps,
          }}
        />
      </div>

      {/* Auto-build everything from multiple URLs */}
      <AutoBuildCard slug={restaurant.slug} restaurantName={restaurant.name} />

      {/* Enrich from a single URL — surgical merge of text fields + photos */}
      <div className="mt-6">
        <EnrichCard
          slug={restaurant.slug}
          current={{
            name: restaurant.name,
            tagline: restaurant.tagline,
            heroHeadline: restaurant.heroHeadline,
            heroSubhead: restaurant.heroSubhead,
            aboutCopy: restaurant.aboutCopy,
            address: restaurant.address,
            city: restaurant.city,
            state: restaurant.state,
            zip: restaurant.zip,
            phone: restaurant.phone,
            email: restaurant.email,
            type: restaurant.type,
            heroImageUrl: restaurant.heroImageUrl,
          }}
        />
      </div>

      <div className="mt-8 text-center">
        <Link
          href={`/r/${restaurant.slug}/admin/settings`}
          className="inline-flex items-center gap-1.5 text-sm text-surface-600 hover:text-brand"
        >
          <Sparkles className="h-4 w-4" /> Edit every detail in Settings
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-surface-200 bg-white p-4">
      <div className="text-xs text-surface-500 uppercase tracking-wider">
        {label}
      </div>
      <div className="mt-1.5 font-display text-2xl text-surface-900 tabular-nums">
        {value}
      </div>
    </div>
  );
}
