import { redirect } from "next/navigation";
import { getCurrentUser, requireOperator } from "@/lib/auth";
import { isBillingConfigured, trialDaysLeft } from "@/lib/subscriptions";
import { OperatorShell } from "@/components/operator/operator-shell";
import { SubscriptionBanner } from "@/components/operator/subscription-banner";
import { operatorLogoutAction } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireOperator();
  if (!auth.authorized) {
    if (auth.reason === "unauthenticated") redirect("/login");
    redirect("/login");
  }
  const { operator } = auth;

  // Gate: if billing is configured (production) and operator hasn't completed
  // checkout yet, send them to the plan picker first.
  // Exception: operators with subscriptionStatus "active" are comped (founders,
  // manual upgrades) and bypass the checkout requirement.
  if (
    isBillingConfigured() &&
    !operator.stripeSubscriptionId &&
    operator.subscriptionStatus !== "active"
  ) {
    redirect("/start");
  }
  const user = await getCurrentUser();

  return (
    <OperatorShell
      operatorName={operator.name ?? "Your agency"}
      businessName={operator.businessName}
      userName={user?.name ?? ""}
      userEmail={user?.email ?? ""}
      topBanner={
        <SubscriptionBanner
          status={operator.subscriptionStatus}
          trialDaysLeft={trialDaysLeft(operator)}
          tier={
            (operator.subscriptionTier as "starter" | "pro" | "agency") ?? "starter"
          }
          cancelAtPeriodEnd={operator.subscriptionCancelAtPeriodEnd}
          currentPeriodEnd={operator.subscriptionCurrentPeriodEnd}
        />
      }
      onLogout={operatorLogoutAction}
    >
      {children}
    </OperatorShell>
  );
}
