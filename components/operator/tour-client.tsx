"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  RefreshCw,
  Trash2,
  Smartphone,
  Monitor,
  ExternalLink,
  ChefHat,
  AlertTriangle,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  clearTestOrders,
  placeTestOrder,
} from "@/app/app/clients/[slug]/tour/actions";

interface Props {
  slug: string;
  restaurantName: string;
  stripeStatus: string;
  menuItemCount: number;
}

type ViewMode = "split" | "phone" | "kitchen";

export function TourClient({
  slug,
  restaurantName,
  stripeStatus,
  menuItemCount,
}: Props) {
  const router = useRouter();
  const [view, setView] = React.useState<ViewMode>("split");
  const [placing, setPlacing] = React.useState(false);
  const [clearing, setClearing] = React.useState(false);
  const [lastOrder, setLastOrder] = React.useState<{
    number: number;
    items: number;
    total: number;
  } | null>(null);
  const [kitchenKey, setKitchenKey] = React.useState(0);
  const [publicKey, setPublicKey] = React.useState(0);

  async function onTestOrder() {
    if (placing) return;
    if (menuItemCount === 0) {
      toast.error("Add menu items first — Tour mode needs something to order.");
      return;
    }
    setPlacing(true);
    try {
      const res = await placeTestOrder({ slug });
      if (res.ok) {
        setLastOrder({
          number: res.orderNumber,
          items: res.itemsPlaced,
          total: res.totalCents,
        });
        toast.success(
          `Order #${res.orderNumber} placed — ${res.itemsPlaced} item${res.itemsPlaced === 1 ? "" : "s"}. Watch the kitchen.`,
          { duration: 5000 }
        );
        // Force the kitchen iframe to refresh
        setKitchenKey((k) => k + 1);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } finally {
      setPlacing(false);
    }
  }

  async function onClearTestOrders() {
    if (clearing) return;
    if (!confirm("Delete all test orders for this restaurant?")) return;
    setClearing(true);
    try {
      const res = await clearTestOrders({ slug });
      if (res.ok) {
        toast.success(
          res.deleted > 0
            ? `Cleared ${res.deleted} test order${res.deleted === 1 ? "" : "s"}`
            : "No test orders to clear"
        );
        setLastOrder(null);
        setKitchenKey((k) => k + 1);
        router.refresh();
      } else {
        toast.error("Clear failed");
      }
    } finally {
      setClearing(false);
    }
  }

  function refreshFrames() {
    setPublicKey((k) => k + 1);
    setKitchenKey((k) => k + 1);
    toast.message("Refreshed both views");
  }

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-surface-900">
      {/* Top bar */}
      <header className="bg-surface-900 text-white border-b border-white/10 px-4 py-3 flex items-center gap-3 flex-wrap shrink-0">
        <Link
          href={`/app/clients/${slug}`}
          className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="h-5 w-px bg-white/20" />
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand" />
          <span className="font-display text-sm">
            Tour mode · <span className="text-white/70">{restaurantName}</span>
          </span>
        </div>

        {/* View toggle */}
        <div className="ml-auto flex items-center gap-1 bg-white/10 rounded-full p-1">
          <ViewToggle
            active={view === "split"}
            onClick={() => setView("split")}
            icon={<Monitor className="h-3.5 w-3.5" />}
            label="Split"
          />
          <ViewToggle
            active={view === "phone"}
            onClick={() => setView("phone")}
            icon={<Smartphone className="h-3.5 w-3.5" />}
            label="Phone only"
          />
          <ViewToggle
            active={view === "kitchen"}
            onClick={() => setView("kitchen")}
            icon={<ChefHat className="h-3.5 w-3.5" />}
            label="Kitchen only"
          />
        </div>

        <button
          type="button"
          onClick={refreshFrames}
          className="inline-flex items-center gap-1.5 text-xs text-white/70 hover:text-white px-2 py-1.5 rounded"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </button>
      </header>

      {/* Status bar */}
      {(menuItemCount === 0 || stripeStatus !== "active") && (
        <div className="bg-amber-100 text-amber-900 px-4 py-2 text-xs flex items-center gap-2 flex-wrap shrink-0">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {menuItemCount === 0 && (
            <span>
              <strong>No menu items.</strong> Tour needs at least 1 item to place a test
              order.{" "}
              <Link
                href={`/r/${slug}/admin/menu`}
                className="underline font-medium"
              >
                Import menu →
              </Link>
            </span>
          )}
          {menuItemCount > 0 && stripeStatus !== "active" && (
            <span>
              Stripe isn&apos;t connected yet — test orders run as &ldquo;pay at
              pickup&rdquo; (still proves the kitchen pipeline).{" "}
              <Link
                href={`/app/clients/${slug}#stripe-card`}
                className="underline font-medium"
              >
                Set up Stripe →
              </Link>
            </span>
          )}
        </div>
      )}

      {/* Main split view */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-0">
        {(view === "split" || view === "phone") && (
          <div
            className={cn(
              "bg-surface-900 grid place-items-center p-4 lg:p-6 overflow-hidden",
              view === "phone" && "lg:col-span-2"
            )}
          >
            <div className="bg-surface-950 rounded-[40px] p-3 shadow-elevated max-h-full">
              <div className="relative">
                {/* Phone frame */}
                <div className="bg-black rounded-[32px] overflow-hidden ring-8 ring-black w-[375px] h-[700px] max-h-[calc(100vh-180px)] shadow-2xl">
                  <iframe
                    key={`public-${publicKey}`}
                    src={`/r/${slug}`}
                    title={`${restaurantName} public site`}
                    className="w-full h-full"
                  />
                </div>
                <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-5 bg-black rounded-full" />
              </div>
            </div>
            <div className="mt-3 text-[10px] uppercase tracking-[0.3em] text-white/40 text-center">
              ← What customers see on their phone
            </div>
          </div>
        )}

        {(view === "split" || view === "kitchen") && (
          <div
            className={cn(
              "bg-surface-100 flex flex-col overflow-hidden",
              view === "kitchen" && "lg:col-span-2"
            )}
          >
            <div className="px-4 py-2.5 bg-surface-50 border-b border-surface-200 flex items-center justify-between text-xs">
              <span className="font-medium text-surface-700 inline-flex items-center gap-1.5">
                <ChefHat className="h-3.5 w-3.5 text-brand" /> Live kitchen view
              </span>
              <Link
                href={`/r/${slug}/admin`}
                target="_blank"
                className="text-surface-500 hover:text-brand inline-flex items-center gap-1"
              >
                Open full <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
            <iframe
              key={`kitchen-${kitchenKey}`}
              src={`/r/${slug}/admin`}
              title={`${restaurantName} kitchen view`}
              className="flex-1 w-full bg-white"
            />
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      <footer className="bg-surface-900 text-white border-t border-white/10 px-4 py-4 flex items-center gap-3 flex-wrap shrink-0">
        <div className="flex-1 min-w-0">
          {lastOrder ? (
            <div className="text-sm">
              <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                <Check className="h-4 w-4" />
                Order #{lastOrder.number} placed
              </span>
              <span className="text-white/60 ml-2">
                {lastOrder.items} item{lastOrder.items === 1 ? "" : "s"} · $
                {(lastOrder.total / 100).toFixed(2)} — should be in the kitchen view
                now.
              </span>
            </div>
          ) : (
            <div className="text-sm text-white/70">
              <strong className="text-white">Walk the restaurant through it:</strong>{" "}
              show them their site on the phone, click below to place a test order,
              watch it land in the kitchen.
            </div>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClearTestOrders}
          disabled={clearing}
        >
          {clearing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
          Clear test orders
        </Button>
        <Button
          type="button"
          onClick={onTestOrder}
          disabled={placing || menuItemCount === 0}
          size="lg"
        >
          {placing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Placing…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" /> Place test order
            </>
          )}
        </Button>
      </footer>
    </div>
  );
}

function ViewToggle({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition",
        active
          ? "bg-white text-surface-900 shadow-soft"
          : "text-white/70 hover:text-white"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
