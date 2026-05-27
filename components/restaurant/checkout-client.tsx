"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Minus,
  Plus,
  Trash2,
  ShoppingBag,
  ArrowRight,
  Loader2,
  CreditCard,
  Banknote,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, formatMoney } from "@/lib/utils";
import { cartCount, cartSubtotalCents, clearCart, readCart, writeCart, type Cart } from "@/lib/cart";
import { placeOrder } from "@/app/r/[slug]/(customer)/checkout/actions";
import { startCardCheckout } from "@/app/r/[slug]/(customer)/checkout/payment-actions";
import type { PickupSlot } from "@/lib/pickup-times";
import { CardPayment } from "./card-payment";

interface CheckoutClientProps {
  slug: string;
  restaurantName: string;
  taxBps: number;
  pickupPills: PickupSlot[];
  pickupMore: string[];
  orderingOpen?: boolean;
  /** True if the restaurant has Stripe connected + charges enabled. */
  cardEnabled?: boolean;
  publishableKey?: string | null;
  stripeAccountId?: string | null;
}

type Step = "details" | "card-payment";
type PaymentMethod = "pickup" | "card";
type TipMode = "none" | "pct" | "custom";

interface CardSession {
  orderId: string;
  orderNumber: number;
  clientSecret: string;
  publishableKey: string;
  stripeAccountId: string;
  totalCents: number;
}

// Tip presets — 18% is pre-selected per design (close to average restaurant tip).
const TIP_PRESETS: { pct: number; label: string }[] = [
  { pct: 15, label: "15%" },
  { pct: 18, label: "18%" },
  { pct: 20, label: "20%" },
  { pct: 25, label: "25%" },
];

function computeTipCents(
  subtotal: number,
  mode: TipMode,
  pct: number,
  customCents: number
): number {
  if (mode === "none") return 0;
  if (mode === "custom") return Math.max(0, Math.min(100000, Math.round(customCents)));
  return Math.round((subtotal * pct) / 100);
}

export function CheckoutClient({
  slug,
  restaurantName,
  taxBps,
  pickupPills,
  pickupMore,
  orderingOpen = true,
  cardEnabled = false,
  publishableKey = null,
  stripeAccountId = null,
}: CheckoutClientProps) {
  const router = useRouter();
  const [cart, setCart] = React.useState<Cart>({});
  const [mounted, setMounted] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>(
    cardEnabled ? "card" : "pickup"
  );
  const [step, setStep] = React.useState<Step>("details");
  const [cardSession, setCardSession] = React.useState<CardSession | null>(null);
  const [tipMode, setTipMode] = React.useState<TipMode>("pct");
  const [tipPct, setTipPct] = React.useState<number>(18);
  const [customTipDollars, setCustomTipDollars] = React.useState<string>("");
  const defaultPickup = pickupPills[0]?.value ?? pickupMore[0] ?? "ASAP";
  const [form, setForm] = React.useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    pickupTime: defaultPickup,
    notes: "",
  });
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});

  const refresh = React.useCallback(() => {
    setCart(readCart(slug));
  }, [slug]);

  React.useEffect(() => {
    refresh();
    setMounted(true);
    const onCart = () => refresh();
    window.addEventListener("cart:changed", onCart as EventListener);
    return () => window.removeEventListener("cart:changed", onCart as EventListener);
  }, [refresh]);

  function setQty(itemId: string, qty: number) {
    const next = { ...cart };
    if (qty <= 0) {
      delete next[itemId];
    } else {
      next[itemId] = { ...next[itemId], quantity: qty };
    }
    writeCart(slug, next);
  }
  function remove(itemId: string) {
    const next = { ...cart };
    delete next[itemId];
    writeCart(slug, next);
  }

  const lines = Object.values(cart);
  const subtotal = cartSubtotalCents(cart);
  const taxes = Math.round((subtotal * taxBps) / 10000);
  const customTipCents = Math.round((Number(customTipDollars) || 0) * 100);
  const tipCents = computeTipCents(subtotal, tipMode, tipPct, customTipCents);
  const total = subtotal + taxes + tipCents;
  const count = cartCount(cart);

  async function onSubmitDetails(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (lines.length === 0) {
      toast.error("Your cart is empty");
      return;
    }
    setSubmitting(true);
    setErrors({});
    try {
      const sharedInput = {
        slug,
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        customerEmail: form.customerEmail || undefined,
        pickupTime: form.pickupTime,
        notes: form.notes || undefined,
        tipCents,
        lines: lines.map((l) => ({
          itemId: l.itemId,
          quantity: l.quantity,
          notes: l.notes,
        })),
      };

      if (paymentMethod === "card") {
        const res = await startCardCheckout(sharedInput);
        if (!res.ok) {
          if (res.fieldErrors) setErrors(res.fieldErrors);
          toast.error(res.error ?? "Could not start payment");
          if (res.unavailableNames?.length) {
            toast.message("Unavailable items", {
              description: res.unavailableNames.join(", "),
            });
          }
          setSubmitting(false);
          return;
        }
        if (!res.clientSecret || !res.publishableKey || !res.stripeAccountId) {
          toast.error("Card payments aren't fully configured. Please pay at pickup.");
          setSubmitting(false);
          return;
        }
        setCardSession({
          orderId: res.orderId!,
          orderNumber: res.orderNumber!,
          clientSecret: res.clientSecret,
          publishableKey: res.publishableKey,
          stripeAccountId: res.stripeAccountId,
          totalCents: total,
        });
        setStep("card-payment");
        setSubmitting(false);
        return;
      }

      // Pay at pickup → original flow
      const res = await placeOrder(sharedInput);
      if (!res.ok) {
        if (res.fieldErrors) setErrors(res.fieldErrors);
        toast.error(res.error ?? "Could not place order");
        if (res.unavailableNames?.length) {
          toast.message("Unavailable items", {
            description: res.unavailableNames.join(", "),
          });
        }
        setSubmitting(false);
        return;
      }
      clearCart(slug);
      toast.success(`Order #${res.orderNumber} placed!`);
      router.push(`/r/${slug}/order/${res.orderId}`);
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  if (!mounted) {
    return (
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="h-12 w-64 shimmer-bg rounded-xl mb-6" />
        <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
          <div className="h-96 shimmer-bg rounded-3xl" />
          <div className="h-96 shimmer-bg rounded-3xl" />
        </div>
      </div>
    );
  }

  if (count === 0 && step !== "card-payment") {
    return (
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-24 text-center">
        <div className="mx-auto h-16 w-16 grid place-items-center rounded-full bg-surface-100 text-surface-500">
          <ShoppingBag className="h-7 w-7" />
        </div>
        <h1 className="mt-6 font-display text-4xl text-surface-900">Your cart is empty</h1>
        <p className="mt-3 text-surface-600">
          Add some of {restaurantName}&apos;s favorites to get started.
        </p>
        <Button asChild className="mt-8" size="lg">
          <Link href={`/r/${slug}/menu`}>
            Browse the menu <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    );
  }

  // ============== STEP: CARD PAYMENT ==============
  if (step === "card-payment" && cardSession) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10 md:py-14">
        <div className="mb-6">
          <div className="text-xs font-mono uppercase tracking-widest text-brand">
            Checkout · Step 2 of 2
          </div>
          <h1 className="mt-2 font-display text-4xl text-surface-900">
            Pay for order #{cardSession.orderNumber}
          </h1>
          <p className="mt-2 text-sm text-surface-600">
            Total {formatMoney(cardSession.totalCents)}. You&apos;ll get a receipt by email.
          </p>
        </div>

        <div className="rounded-3xl border border-surface-200 bg-white shadow-soft p-6 md:p-8 mb-4">
          <CardPayment
            publishableKey={cardSession.publishableKey}
            stripeAccountId={cardSession.stripeAccountId}
            clientSecret={cardSession.clientSecret}
            totalCents={cardSession.totalCents}
            returnUrl={`${window.location.origin}/r/${slug}/order/${cardSession.orderId}`}
            onCancel={() => {
              setStep("details");
              setCardSession(null);
            }}
          />
        </div>

        <div className="text-xs text-surface-500 text-center">
          Order isn&apos;t sent to the kitchen until payment succeeds.
        </div>
      </div>
    );
  }

  const tipIsActive = (pct: number) => tipMode === "pct" && tipPct === pct;

  // ============== STEP: DETAILS ==============
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 md:py-14 pb-32 lg:pb-14">
      <div className="flex items-end justify-between gap-4 mb-8">
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-brand">
            Checkout
          </div>
          <h1 className="mt-2 font-display text-4xl md:text-5xl text-surface-900">
            Your order
          </h1>
        </div>
        <Link href={`/r/${slug}/menu`} className="text-sm font-medium text-brand hover:underline">
          ← Add more items
        </Link>
      </div>

      <form
        onSubmit={onSubmitDetails}
        className="grid gap-8 lg:grid-cols-[1fr_400px] items-start"
      >
        <div className="space-y-8">
          <section className="rounded-3xl border border-surface-200 bg-white shadow-soft overflow-hidden">
            <header className="px-6 py-4 border-b border-surface-100">
              <h2 className="font-display text-xl text-surface-900">Items ({count})</h2>
            </header>
            <ul className="divide-y divide-surface-100">
              <AnimatePresence initial={false}>
                {lines.map((line) => (
                  <motion.li
                    key={line.itemId}
                    layout
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-4">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-surface-900 truncate">{line.name}</div>
                        <div className="text-sm text-surface-500 font-mono">
                          {formatMoney(line.priceCents)}
                        </div>
                      </div>
                      <div className="inline-flex items-center rounded-full bg-surface-100 shrink-0">
                        <button
                          type="button"
                          onClick={() => setQty(line.itemId, line.quantity - 1)}
                          className="h-11 w-11 grid place-items-center rounded-full hover:bg-surface-200 text-surface-700 transition"
                          aria-label="Decrease"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="min-w-7 text-center text-sm font-medium tabular-nums">
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQty(line.itemId, line.quantity + 1)}
                          className="h-11 w-11 grid place-items-center rounded-full hover:bg-surface-200 text-surface-700 transition"
                          aria-label="Increase"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="hidden sm:block w-20 text-right font-mono text-sm tabular-nums shrink-0">
                        {formatMoney(line.priceCents * line.quantity)}
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(line.itemId)}
                        className="text-surface-400 hover:text-red-600 transition h-11 w-11 grid place-items-center -mr-2"
                        aria-label="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </section>

          <section className="rounded-3xl border border-surface-200 bg-white shadow-soft p-6">
            <h2 className="font-display text-xl text-surface-900 mb-5">Pickup details</h2>
            <div className="grid gap-5">
              <div className="grid gap-1.5">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  required
                  autoComplete="name"
                  value={form.customerName}
                  onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
                  className={cn(errors.customerName && "border-red-400")}
                />
                {errors.customerName && (
                  <p className="text-xs text-red-600">{errors.customerName[0]}</p>
                )}
              </div>
              <div className="grid sm:grid-cols-2 gap-5">
                <div className="grid gap-1.5">
                  <Label htmlFor="phone">Phone *</Label>
                  <Input
                    id="phone"
                    required
                    type="tel"
                    autoComplete="tel"
                    placeholder="(555) 123-4567"
                    value={form.customerPhone}
                    onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
                    className={cn(errors.customerPhone && "border-red-400")}
                  />
                  {errors.customerPhone && (
                    <p className="text-xs text-red-600">{errors.customerPhone[0]}</p>
                  )}
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="email">
                    Email {paymentMethod === "card" ? "(for receipt)" : "(optional)"}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={form.customerEmail}
                    onChange={(e) => setForm((f) => ({ ...f, customerEmail: e.target.value }))}
                    className={cn(errors.customerEmail && "border-red-400")}
                  />
                  {errors.customerEmail && (
                    <p className="text-xs text-red-600">{errors.customerEmail[0]}</p>
                  )}
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Pickup time</Label>
                {pickupPills.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {pickupPills.map((p) => {
                      const selected = form.pickupTime === p.value;
                      return (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, pickupTime: p.value }))}
                          className={cn(
                            "h-11 rounded-full border-2 px-4 text-sm font-medium transition",
                            selected
                              ? "border-brand bg-brand text-brand-fg shadow-soft"
                              : "border-surface-200 bg-white text-surface-700 hover:border-surface-300"
                          )}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-surface-500">No pickup times available right now.</p>
                )}
                {pickupMore.length > 0 && (
                  <div className="mt-1">
                    <Select
                      value={
                        pickupPills.some((p) => p.value === form.pickupTime)
                          ? ""
                          : form.pickupTime
                      }
                      onValueChange={(v) =>
                        v && setForm((f) => ({ ...f, pickupTime: v }))
                      }
                    >
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Or pick a later time…" />
                      </SelectTrigger>
                      <SelectContent>
                        {pickupMore.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="notes">Notes for the kitchen (optional)</Label>
                <Textarea
                  id="notes"
                  rows={3}
                  placeholder="Allergies, special requests…"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-surface-200 bg-white shadow-soft p-6">
            <div className="flex items-baseline justify-between gap-4 mb-4">
              <h2 className="font-display text-xl text-surface-900">Add a tip</h2>
              <span className="text-xs text-surface-500">
                100% goes to the team
              </span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {TIP_PRESETS.map((p) => {
                const active = tipIsActive(p.pct);
                return (
                  <button
                    key={p.pct}
                    type="button"
                    onClick={() => {
                      setTipMode("pct");
                      setTipPct(p.pct);
                    }}
                    className={cn(
                      "relative h-14 rounded-2xl border-2 px-3 text-center transition",
                      active
                        ? "border-brand bg-brand/5"
                        : "border-surface-200 bg-white hover:border-surface-300"
                    )}
                  >
                    <div
                      className={cn(
                        "font-display text-lg leading-tight",
                        active ? "text-brand" : "text-surface-900"
                      )}
                    >
                      {p.label}
                    </div>
                    <div className="text-[11px] text-surface-500 font-mono tabular-nums">
                      {formatMoney(Math.round((subtotal * p.pct) / 100))}
                    </div>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setTipMode("custom");
                  if (!customTipDollars) setCustomTipDollars("");
                }}
                className={cn(
                  "h-14 rounded-2xl border-2 px-3 text-center transition flex items-center justify-center",
                  tipMode === "custom"
                    ? "border-brand bg-brand/5 text-brand"
                    : "border-surface-200 bg-white text-surface-900 hover:border-surface-300"
                )}
              >
                <div className="font-display text-base leading-tight">Custom</div>
              </button>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setTipMode("none")}
                className={cn(
                  "h-9 rounded-full border-2 px-4 text-xs font-medium transition",
                  tipMode === "none"
                    ? "border-surface-400 bg-surface-100 text-surface-700"
                    : "border-transparent bg-surface-50 text-surface-500 hover:bg-surface-100"
                )}
              >
                No tip
              </button>
              {tipMode === "custom" && (
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-sm text-surface-500">$</span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={customTipDollars}
                    onChange={(e) => setCustomTipDollars(e.target.value)}
                    className="h-10 max-w-32"
                    inputMode="decimal"
                  />
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 space-y-4">
          {cardEnabled && publishableKey && stripeAccountId && (
            <div className="rounded-3xl border border-surface-200 bg-white shadow-soft p-6">
              <h2 className="font-display text-xl text-surface-900 mb-4">Payment</h2>
              <div className="grid gap-2">
                <PaymentMethodOption
                  selected={paymentMethod === "card"}
                  onClick={() => setPaymentMethod("card")}
                  icon={<CreditCard className="h-4 w-4" />}
                  title="Pay now"
                  description="Card, Apple Pay, Google Pay"
                />
                <PaymentMethodOption
                  selected={paymentMethod === "pickup"}
                  onClick={() => setPaymentMethod("pickup")}
                  icon={<Banknote className="h-4 w-4" />}
                  title="Pay at pickup"
                  description="Cash or card in person"
                />
              </div>
            </div>
          )}

          <div className="rounded-3xl border border-surface-200 bg-white shadow-soft p-6">
            <h2 className="font-display text-xl text-surface-900 mb-5">Order summary</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between text-surface-700">
                <dt>Subtotal</dt>
                <dd className="font-mono tabular-nums">{formatMoney(subtotal)}</dd>
              </div>
              <div className="flex justify-between text-surface-700">
                <dt>Tax ({(taxBps / 100).toFixed(2)}%)</dt>
                <dd className="font-mono tabular-nums">{formatMoney(taxes)}</dd>
              </div>
              {tipCents > 0 && (
                <div className="flex justify-between text-surface-700">
                  <dt>
                    Tip{tipMode === "pct" && ` (${tipPct}%)`}
                  </dt>
                  <dd className="font-mono tabular-nums">{formatMoney(tipCents)}</dd>
                </div>
              )}
              <div className="h-px bg-surface-100 my-2" />
              <div className="flex justify-between text-surface-900 font-medium text-base">
                <dt>Total</dt>
                <dd className="font-mono tabular-nums">{formatMoney(total)}</dd>
              </div>
            </dl>
            <div className="mt-5 rounded-2xl bg-surface-50 px-4 py-3 text-xs text-surface-600">
              {paymentMethod === "card" ? (
                <>
                  <Lock className="h-3 w-3 inline-block mr-1.5 -mt-0.5" />
                  Card is charged on the next step. Your order is held until payment succeeds.
                </>
              ) : (
                <>Payment is collected at pickup. We&apos;ll text you when your order is ready.</>
              )}
            </div>
            <Button
              type="submit"
              size="lg"
              className="mt-5 w-full h-12"
              disabled={submitting || lines.length === 0 || !orderingOpen}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> {paymentMethod === "card" ? "Starting payment…" : "Placing order…"}
                </>
              ) : !orderingOpen ? (
                <>Online ordering is closed</>
              ) : paymentMethod === "card" ? (
                <>
                  <CreditCard className="h-4 w-4" /> Pay {formatMoney(total)}
                </>
              ) : (
                <>Place order · {formatMoney(total)}</>
              )}
            </Button>
          </div>
        </aside>

        {/* Mobile-only sticky pay button so customers don't have to scroll to the summary */}
        <div
          className="lg:hidden fixed inset-x-0 bottom-0 z-40 px-3 pt-3 pb-[max(env(safe-area-inset-bottom),12px)] bg-gradient-to-t from-surface-50 via-surface-50/95 to-transparent pointer-events-none"
        >
          <Button
            type="submit"
            size="lg"
            disabled={submitting || lines.length === 0 || !orderingOpen}
            className="pointer-events-auto w-full h-14 text-base shadow-elevated"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> {paymentMethod === "card" ? "Starting payment…" : "Placing order…"}
              </>
            ) : !orderingOpen ? (
              <>Online ordering is closed</>
            ) : paymentMethod === "card" ? (
              <>
                <Lock className="h-4 w-4" /> Pay {formatMoney(total)}
              </>
            ) : (
              <>Place order · {formatMoney(total)}</>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

function PaymentMethodOption({
  selected,
  onClick,
  icon,
  title,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition-all",
        selected
          ? "border-brand bg-brand/5"
          : "border-surface-200 hover:border-surface-300"
      )}
    >
      <div
        className={cn(
          "h-9 w-9 grid place-items-center rounded-full shrink-0",
          selected ? "bg-brand text-brand-fg" : "bg-surface-100 text-surface-600"
        )}
      >
        {icon}
      </div>
      <div className="flex-1">
        <div className="font-medium text-surface-900">{title}</div>
        <div className="text-xs text-surface-500 mt-0.5">{description}</div>
      </div>
      <div
        className={cn(
          "h-5 w-5 rounded-full border-2 shrink-0 mt-1 transition",
          selected ? "border-brand bg-brand" : "border-surface-300"
        )}
      >
        {selected && <div className="m-1 h-1.5 w-1.5 rounded-full bg-white" />}
      </div>
    </button>
  );
}
