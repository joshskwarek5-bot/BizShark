"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Check, ChefHat, PartyPopper, X, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { type OrderStatus } from "@/lib/order-status";
import { updateOrderStatus } from "@/app/r/[slug]/admin/(panel)/actions";

interface OrderStatusControlsProps {
  slug: string;
  orderId: string;
  status: OrderStatus;
}

const ADVANCE: Record<OrderStatus, OrderStatus | null> = {
  new: "preparing",
  preparing: "ready",
  ready: "completed",
  completed: null,
  cancelled: null,
};

const ADVANCE_LABEL: Record<OrderStatus, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  new: { label: "Accept & start preparing", icon: ChefHat },
  preparing: { label: "Mark ready for pickup", icon: PartyPopper },
  ready: { label: "Mark picked up", icon: Check },
  completed: { label: "—", icon: Check },
  cancelled: { label: "—", icon: X },
};

export function OrderStatusControls({ slug, orderId, status }: OrderStatusControlsProps) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const next = ADVANCE[status];

  async function set(to: OrderStatus, message?: string) {
    setPending(true);
    try {
      const res = await updateOrderStatus({ slug, orderId, status: to });
      if (!res.ok) {
        toast.error(res.error ?? "Could not update");
      } else {
        toast.success(message ?? "Status updated");
        router.refresh();
      }
    } catch (e) {
      toast.error("Network error");
      console.error(e);
    } finally {
      setPending(false);
    }
  }

  if (status === "completed" || status === "cancelled") {
    return (
      <div className="rounded-2xl bg-surface-100 px-5 py-4 text-sm text-surface-700">
        This order is {status === "completed" ? "complete" : "cancelled"}. No further actions.
      </div>
    );
  }

  const NextIcon = ADVANCE_LABEL[status].icon;

  return (
    <div className="flex flex-wrap gap-3">
      {next && (
        <button
          type="button"
          onClick={() => set(next, ADVANCE_LABEL[status].label)}
          disabled={pending}
          className={cn(
            "inline-flex h-12 items-center gap-2 rounded-full bg-brand pl-5 pr-3 text-sm font-medium text-brand-fg shadow-soft hover:shadow-elevated transition active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
          )}
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <NextIcon className="h-4 w-4" />
          )}
          {ADVANCE_LABEL[status].label}
          <span className="grid h-8 w-8 place-items-center rounded-full bg-white/20">
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          if (confirm("Cancel this order?")) set("cancelled", "Order cancelled");
        }}
        disabled={pending}
        className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-5 text-sm font-medium text-red-700 ring-1 ring-red-200 hover:bg-red-50 transition disabled:opacity-60"
      >
        <X className="h-4 w-4" />
        Cancel order
      </button>
    </div>
  );
}
