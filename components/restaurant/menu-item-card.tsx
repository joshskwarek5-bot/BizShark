"use client";

import * as React from "react";
import Image from "next/image";
import { Plus, Check } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { cn, formatMoney } from "@/lib/utils";
import { readCart, writeCart, type CartLine } from "@/lib/cart";

interface MenuItemCardProps {
  slug: string;
  item: {
    id: string;
    name: string;
    description: string | null;
    priceCents: number;
    isAvailable: boolean;
    imageUrl: string | null;
  };
  /** When false, add-to-cart is disabled (ordering paused / outside hours). */
  orderingOpen?: boolean;
}

export function MenuItemCard({ slug, item, orderingOpen = true }: MenuItemCardProps) {
  const [added, setAdded] = React.useState(false);
  const [inCart, setInCart] = React.useState(0);
  const disabled = !item.isAvailable || !orderingOpen;

  const refresh = React.useCallback(() => {
    const cart = readCart(slug);
    setInCart(cart[item.id]?.quantity ?? 0);
  }, [slug, item.id]);

  React.useEffect(() => {
    refresh();
    const onCart = () => refresh();
    window.addEventListener("cart:changed", onCart as EventListener);
    return () => window.removeEventListener("cart:changed", onCart as EventListener);
  }, [refresh]);

  function add() {
    if (disabled) return;
    const cart = readCart(slug);
    const existing = cart[item.id];
    const next: CartLine = existing
      ? { ...existing, quantity: existing.quantity + 1 }
      : {
          itemId: item.id,
          name: item.name,
          priceCents: item.priceCents,
          quantity: 1,
        };
    cart[item.id] = next;
    writeCart(slug, cart);
    setAdded(true);
    toast.success(`Added ${item.name}`, {
      description: formatMoney(item.priceCents),
      duration: 1800,
    });
    setTimeout(() => setAdded(false), 1200);
  }

  return (
    <div
      className={cn(
        "group relative flex items-start justify-between gap-4 rounded-2xl border border-transparent bg-white px-4 sm:px-5 py-4 transition-all hover:border-surface-200 hover:shadow-soft",
        !item.isAvailable && "opacity-50"
      )}
    >
      {item.imageUrl && (
        <div className="relative h-20 w-20 sm:h-24 sm:w-24 shrink-0 overflow-hidden rounded-xl bg-surface-100">
          <Image
            src={item.imageUrl}
            alt={item.name}
            fill
            sizes="(max-width: 640px) 80px, 96px"
            className="object-cover transition group-hover:scale-105"
          />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="font-display text-lg text-surface-900 leading-snug">{item.name}</h3>
          <div className="font-mono text-sm text-surface-700 tabular-nums shrink-0">
            {formatMoney(item.priceCents)}
          </div>
        </div>
        {item.description && (
          <p className="mt-1.5 text-sm text-surface-600 leading-relaxed pr-4">
            {item.description}
          </p>
        )}
        {!item.isAvailable && (
          <div className="mt-2 inline-flex text-xs font-medium text-amber-700 bg-amber-50 ring-1 ring-amber-200 rounded-full px-2 py-0.5">
            Currently unavailable
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={add}
        disabled={disabled}
        aria-label={`Add ${item.name} to cart`}
        title={!orderingOpen ? "Online ordering is closed" : undefined}
        className={cn(
          "relative shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-full transition-all",
          added
            ? "bg-emerald-500 text-white"
            : "bg-surface-100 text-surface-700 hover:bg-brand hover:text-brand-fg",
          "disabled:cursor-not-allowed disabled:bg-surface-100 disabled:text-surface-400 disabled:hover:bg-surface-100",
          "active:scale-95"
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          {added ? (
            <motion.span
              key="check"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Check className="h-5 w-5" />
            </motion.span>
          ) : (
            <motion.span
              key="plus"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Plus className="h-5 w-5" />
            </motion.span>
          )}
        </AnimatePresence>
        {inCart > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-semibold text-brand-fg shadow-soft">
            {inCart}
          </span>
        )}
      </button>
    </div>
  );
}
