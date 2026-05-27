"use client";

import * as React from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { Loader2, Lock, ShieldCheck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/utils";

interface CardPaymentProps {
  publishableKey: string;
  stripeAccountId: string;
  clientSecret: string;
  totalCents: number;
  returnUrl: string;
  onCancel: () => void;
}

// Cache Stripe instances by (publishableKey, account) tuple so multiple mounts
// of CardPayment don't refetch Stripe.js.
const stripeCache = new Map<string, Promise<Stripe | null>>();
function getStripeJs(publishableKey: string, stripeAccount: string) {
  const key = `${publishableKey}::${stripeAccount}`;
  let p = stripeCache.get(key);
  if (!p) {
    p = loadStripe(publishableKey, { stripeAccount });
    stripeCache.set(key, p);
  }
  return p;
}

export function CardPayment({
  publishableKey,
  stripeAccountId,
  clientSecret,
  totalCents,
  returnUrl,
  onCancel,
}: CardPaymentProps) {
  const stripePromise = React.useMemo(
    () => getStripeJs(publishableKey, stripeAccountId),
    [publishableKey, stripeAccountId]
  );

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: "stripe",
          variables: {
            colorPrimary: "rgb(var(--brand-rgb))",
            colorBackground: "#ffffff",
            colorText: "#27211a",
            colorDanger: "#dc2626",
            fontFamily: "var(--font-sans), system-ui, sans-serif",
            borderRadius: "12px",
            spacingUnit: "4px",
          },
        },
      }}
    >
      <CardForm totalCents={totalCents} returnUrl={returnUrl} onCancel={onCancel} />
    </Elements>
  );
}

function CardForm({
  totalCents,
  returnUrl,
  onCancel,
}: {
  totalCents: number;
  returnUrl: string;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements || paying) return;
    setPaying(true);
    setError(null);
    const { error: stripeErr } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
    });
    // If we get here, the payment failed before redirect (e.g., card declined,
    // validation error). A successful payment redirects to return_url.
    if (stripeErr) {
      // Friendlier message for the most common decline reasons; fall back to
      // whatever Stripe gives us.
      const code = stripeErr.code ?? stripeErr.decline_code;
      let msg = stripeErr.message ?? "Payment failed";
      if (code === "card_declined") {
        msg = "Your card was declined. Please try a different card or payment method.";
      } else if (code === "expired_card") {
        msg = "That card has expired. Please use a different card.";
      } else if (code === "incorrect_cvc") {
        msg = "The security code is incorrect. Please re-enter it.";
      } else if (code === "insufficient_funds") {
        msg = "The card has insufficient funds. Please use a different card.";
      } else if (stripeErr.type === "validation_error") {
        msg = stripeErr.message ?? "Please fill in all card details.";
      }
      setError(msg);
      setPaying(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="rounded-2xl border border-surface-200 bg-white p-4">
        <PaymentElement options={{ layout: "tabs" }} />
      </div>
      {error && (
        <div className="rounded-xl bg-red-50 ring-1 ring-red-200 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      <div className="flex items-center gap-3 text-xs text-surface-500">
        <ShieldCheck className="h-3.5 w-3.5" />
        Payment is processed securely by Stripe. We never see your card details.
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={paying}>
          Back
        </Button>
        <Button type="submit" size="lg" disabled={!stripe || !elements || paying} className="flex-1">
          {paying ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Processing…
            </>
          ) : (
            <>
              <Lock className="h-4 w-4" /> Pay {formatMoney(totalCents)}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
