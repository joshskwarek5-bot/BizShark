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
  orderingOpen?: boolean;
}

/**
 * Classic menu card — typeset like a printed menu: serif name, dotted price
 * leader, italic description, square thumbnail on the right. No backgrounds
 * or rounded corners on the card itself; each item is a row.
 */
export function ClassicMenuItemCard({ slug, item, orderingOpen = true }: MenuItemCardProps) {
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
        "group flex items-start gap-5 border-b border-surface-200 py-5",
        !item.isAvailable && "opacity-50"
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <h3 className="font-display text-xl text-surface-900 leading-snug">
            {item.name}
          </h3>
          <div className="flex-1 border-b border-dotted border-surface-300 mb-1 min-w-4" />
          <div className="font-mono text-sm text-surface-800 tabular-nums shrink-0">
            {formatMoney(item.priceCents)}
          </div>
        </div>
        {item.description && (
          <p className="mt-1.5 text-sm text-surface-600 italic leading-relaxed pr-4">
            {item.description}
          </p>
        )}
        {!item.isAvailable && (
          <div className="mt-2 inline-flex text-xs font-medium uppercase tracking-widest text-amber-700">
            Currently unavailable
          </div>
        )}
      </div>

      {item.imageUrl && (
        <div className="relative h-20 w-20 sm:h-24 sm:w-24 shrink-0 overflow-hidden border border-surface-200">
          <Image
            src={item.imageUrl}
            alt={item.name}
            fill
            sizes="(max-width: 640px) 80px, 96px"
            className="object-cover"
          />
        </div>
      )}

      <button
        type="button"
        onClick={add}
        disabled={disabled}
        aria-label={`Add ${item.name}`}
        title={!orderingOpen ? "Online ordering is closed" : undefined}
        className={cn(
          "relative shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-none border transition",
          added
            ? "bg-emerald-600 text-white border-emerald-600"
            : "bg-surface-900 text-surface-50 border-surface-900 hover:bg-surface-700",
          "disabled:cursor-not-allowed disabled:bg-surface-200 disabled:text-surface-400 disabled:border-surface-200"
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
          <span className="absolute -top-2 -right-2 inline-flex h-5 min-w-5 items-center justify-center bg-brand px-1.5 text-[11px] font-semibold text-brand-fg shadow-soft">
            {inCart}
          </span>
        )}
      </button>
    </div>
  );
}
