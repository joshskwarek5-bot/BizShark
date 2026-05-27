import { notFound, redirect } from "next/navigation";
import { Receipt } from "lucide-react";
import { db } from "@/lib/db";
import { requireRestaurantAdmin } from "@/lib/auth";
import { ClientFacingBilling } from "@/components/admin/client-facing-billing";

export const dynamic = "force-dynamic";
export const metadata = { title: "Billing" };

export default async function ClientAdminBillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ subscribed?: string }>;
}) {
  const { slug } = await params;
  const { subscribed } = await searchParams;
  const auth = await requireRestaurantAdmin(slug);
  if (!auth.authorized) {
    if (auth.reason === "unauthenticated") redirect(`/r/${slug}/admin/login`);
    redirect("/");
  }
  const { restaurant } = auth;

  const billing = await db.clientBilling.findUnique({
    where: { restaurantId: restaurant.id },
    include: { operator: { select: { name: true, businessName: true, pitchPhone: true } } },
  });
  const invoices = billing
    ? await db.clientInvoice.findMany({
        where: { restaurantId: restaurant.id },
        orderBy: { createdAt: "desc" },
        take: 100,
      })
    : [];

  if (!billing) {
    return (
      <div className="px-4 sm:px-6 lg:px-10 py-8 max-w-3xl">
        <div className="mb-8">
          <div className="text-xs font-mono uppercase tracking-widest text-brand">
            Billing
          </div>
          <h1 className="mt-2 font-display text-4xl text-surface-900">
            Billing &amp; invoices
          </h1>
        </div>
        <div className="rounded-3xl border border-surface-200 bg-white shadow-soft p-10 text-center">
          <div className="mx-auto h-14 w-14 grid place-items-center rounded-full bg-surface-100 text-surface-500">
            <Receipt className="h-7 w-7" />
          </div>
          <h2 className="mt-4 font-display text-xl text-surface-900">
            Nothing to pay right now
          </h2>
          <p className="mt-2 text-sm text-surface-600 max-w-md mx-auto">
            Your provider hasn&apos;t set up billing for this site yet. When they do,
            any invoices or recurring charges will show up here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ClientFacingBilling
      slug={slug}
      restaurantName={restaurant.name}
      providerName={
        billing.operator.businessName ?? billing.operator.name ?? "your provider"
      }
      providerPhone={billing.operator.pitchPhone ?? null}
      mode={billing.mode}
      monthlyAmountCents={
        billing.mode === "monthly" ? billing.amountCents : null
      }
      percentageBps={billing.percentageBps}
      hasActiveSubscription={!!billing.stripeSubscriptionId}
      pendingCheckoutUrl={billing.pendingCheckoutUrl}
      subscriptionStatus={billing.status}
      checkoutFlash={subscribed === "1" ? "success" : subscribed === "0" ? "canceled" : null}
      invoices={invoices.map((i) => ({
        id: i.id,
        amountCents: i.amountCents,
        status: i.status,
        description: i.description,
        hostedUrl: i.hostedUrl,
        dueAt: i.dueAt?.toISOString() ?? null,
        paidAt: i.paidAt?.toISOString() ?? null,
        createdAt: i.createdAt.toISOString(),
      }))}
    />
  );
}
