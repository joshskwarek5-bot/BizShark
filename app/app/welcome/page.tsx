import { redirect } from "next/navigation";
import { requireOperator } from "@/lib/auth";
import { trialDaysLeft } from "@/lib/subscriptions";
import { OnboardingWizard } from "@/components/operator/onboarding-wizard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Welcome" };

export default async function WelcomePage() {
  const auth = await requireOperator();
  if (!auth.authorized) redirect("/login");
  const { operator } = auth;

  // Already finished onboarding? Skip to dashboard.
  if (operator.onboardingCompletedAt) redirect("/app");

  return (
    <OnboardingWizard
      operatorName={operator.name ?? "you"}
      businessName={operator.businessName}
      areaCity={operator.areaCity}
      areaState={operator.areaState}
      hasGooglePlacesKey={!!operator.googlePlacesApiKey}
      trialDaysLeft={trialDaysLeft(operator)}
    />
  );
}
