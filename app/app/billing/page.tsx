import { redirect } from "next/navigation";
import { requireOperator } from "@/lib/auth";
import { isBillingConfigured, trialDaysLeft } from "@/lib/subscriptions";
import { BillingPageClient } from "@/components/operator/billing-page-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Billing" };

export default async function OperatorBillingPage() {
  const auth = await requireOperator();
  if (!auth.authorized) redirect("/login");
  const { operator } = auth;

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="font-display text-4xl text-surface-900">Billing</h1>
        <p className="text-sm text-surface-500 mt-1">
          Your subscription, plan limits, and invoices.
        </p>
      </div>
      <BillingPageClient
        billingConfigured={isBillingConfigured()}
        current={{
          tier: (operator.subscriptionTier as "starter" | "pro" | "agency") ?? "starter",
          status: operator.subscriptionStatus,
          trialDaysLeft: trialDaysLeft(operator),
          currentPeriodEnd: operator.subscriptionCurrentPeriodEnd?.toISOString() ?? null,
          cancelAtPeriodEnd: operator.subscriptionCancelAtPeriodEnd,
          hasStripeCustomer: !!operator.stripeCustomerId,
        }}
      />
    </div>
  );
}
