import { redirect } from "next/navigation";
import { requireOperator } from "@/lib/auth";
import { isStripeConfigured } from "@/lib/stripe";
import { refreshSubscriptionStatus } from "@/app/app/billing/actions";

export const dynamic = "force-dynamic";

export default async function StartCompletePage() {
  const auth = await requireOperator();
  if (!auth.authorized) redirect("/login");

  // Sync subscription status from Stripe before sending the user into the app
  if (isStripeConfigured()) {
    try {
      await refreshSubscriptionStatus();
    } catch {
      // Best-effort — the webhook will catch up if this fails
    }
  }

  redirect("/app/welcome");
}
