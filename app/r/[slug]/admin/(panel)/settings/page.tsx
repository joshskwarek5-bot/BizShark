import { notFound } from "next/navigation";
import { getRestaurantBySlug } from "@/lib/restaurant";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { isStripeConfigured } from "@/lib/stripe";
import { clientTypeMeta } from "@/lib/client-type";
import { SettingsForm } from "@/components/admin/settings-form";
import { OrderingControls } from "@/components/admin/ordering-controls";
import { OrderingPreferencesCard } from "@/components/admin/ordering-preferences-card";
import { RevenuePinSettings } from "@/components/admin/revenue-pin-settings";
import { StripeConnectCard } from "@/components/admin/stripe-connect-card";
import { TemplatePicker } from "@/components/admin/template-picker";
import { BrandImageCard } from "@/components/admin/brand-image-card";
import { FeatureTogglesCard } from "@/components/admin/feature-toggles-card";
import {
  BUSINESS_TYPES,
  type BusinessType,
} from "@/lib/business-types";
import { effectiveFeatureList } from "@/lib/features";
import { parseTipPresets } from "@/lib/ordering";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const r = await getRestaurantBySlug(slug);
  if (!r) notFound();
  const session = await getSession();
  const meta = clientTypeMeta(r.type);

  // Is the operator's OpenAI key set? Drives the "Enhance with AI" buttons.
  const hasOpenAI = r.operatorId
    ? Boolean(
        (
          await db.operator.findUnique({
            where: { id: r.operatorId },
            select: { openaiApiKey: true },
          })
        )?.openaiApiKey
      )
    : false;

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-8">
      <div className="mb-8">
        <h1 className="font-display text-4xl text-surface-900">Settings</h1>
        <p className="text-sm text-surface-500 mt-1">
          Update your business info, hours, branding, and payments.
        </p>
      </div>
      <div className="space-y-6 max-w-4xl">
        <FeatureTogglesCard
          slug={r.slug}
          type={
            (BUSINESS_TYPES as readonly string[]).includes(r.type)
              ? (r.type as BusinessType)
              : "restaurant"
          }
          initial={effectiveFeatureList(
            (BUSINESS_TYPES as readonly string[]).includes(r.type)
              ? (r.type as BusinessType)
              : "restaurant",
            r.enabledFeatures
          )}
        />
        <BrandImageCard
          slug={r.slug}
          kind="hero"
          initialUrl={r.heroImageUrl}
          restaurantName={r.name}
          hasOpenAI={hasOpenAI}
        />
        <BrandImageCard
          slug={r.slug}
          kind="logo"
          initialUrl={r.logoUrl}
          restaurantName={r.name}
          hasOpenAI={hasOpenAI}
        />
        <TemplatePicker
          slug={r.slug}
          current={r.templateId}
          primaryColor={r.primaryColor}
          accentColor={r.accentColor}
        />
        {meta.hasOrdering && (
          <StripeConnectCard
            slug={r.slug}
            stripeConfigured={isStripeConfigured()}
            status={r.stripeAccountStatus}
            chargesEnabled={r.stripeChargesEnabled}
            payoutsEnabled={r.stripePayoutsEnabled}
            accountId={r.stripeAccountId}
            platformFeeBps={r.platformFeeBps}
            isSuper={session.role === "super_admin"}
          />
        )}
        {meta.hasOrdering && (
          <OrderingPreferencesCard
            slug={r.slug}
            initial={{
              tipPresets: parseTipPresets(r.tipPresets),
              minOrderCents: r.minOrderCents,
              prepTimeMinutes: r.prepTimeMinutes,
              acceptsCash: r.acceptsCash,
              acceptsCard: r.acceptsCard,
              statementDescriptor: r.statementDescriptor,
              taxInclusive: r.taxInclusive,
            }}
          />
        )}
        {meta.hasOrdering && (
          <OrderingControls
            slug={r.slug}
            isOrderingPaused={r.isOrderingPaused}
            orderingHours={r.orderingHours}
            hours={r.hours}
          />
        )}
        {meta.hasOrdering && (
          <RevenuePinSettings slug={r.slug} hasPin={r.revenuePinHash !== null} />
        )}
      </div>
      <div className="mt-6">
        <SettingsForm
          slug={r.slug}
          initial={{
            name: r.name,
            tagline: r.tagline,
            description: r.description,
            address: r.address,
            city: r.city,
            state: r.state,
            zip: r.zip,
            phone: r.phone,
            email: r.email,
            primaryColor: r.primaryColor,
            accentColor: r.accentColor,
            taxBps: r.taxBps,
            hours: r.hours,
          }}
        />
      </div>
    </div>
  );
}
