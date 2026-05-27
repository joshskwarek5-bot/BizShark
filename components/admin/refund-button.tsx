"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, RotateCcw } from "lucide-react";
import { refundOrder } from "@/app/r/[slug]/admin/(panel)/orders/refund-actions";

interface RefundButtonProps {
  slug: string;
  orderId: string;
  totalCents: number;
}

export function RefundButton({ slug, orderId, totalCents }: RefundButtonProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function onClick() {
    if (pending) return;
    const dollars = (totalCents / 100).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
    });
    if (
      !confirm(
        `Refund ${dollars} to the customer's card?\n\nThis cancels the order and refunds the full amount via Stripe.`
      )
    ) {
      return;
    }
    setPending(true);
    try {
      const res = await refundOrder({ slug, orderId });
      if (!res.ok) {
        toast.error(res.error ?? "Refund failed");
      } else {
        toast.success("Order refunded");
        router.refresh();
      }
    } catch (e) {
      console.error(e);
      toast.error("Network error");
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-5 text-sm font-medium text-red-700 ring-1 ring-red-200 hover:bg-red-50 transition disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <RotateCcw className="h-4 w-4" />
      )}
      Refund order
    </button>
  );
}
