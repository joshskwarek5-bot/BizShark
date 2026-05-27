"use client";

import * as React from "react";
import Link from "next/link";
import { ShoppingBag, ArrowRight } from "lucide-react";
import { cartCount, cartSubtotalCents, readCart } from "@/lib/cart";
import { formatMoney } from "@/lib/utils";

interface StickyCartBarProps {
  slug: string;
  /** When false, ordering is closed — bar still shows but with disabled state. */
  orderingOpen?: boolean;
}

/**
 * Mobile-only sticky checkout bar. Appears at the bottom of the viewport once
 * the cart has at least one item. Hidden on md+ where the inline checkout CTA
 * on the menu page is more discoverable.
 */
export function StickyCartBar({ slug, orderingOpen = true }: StickyCartBarProps) {
  const [count, setCount] = React.useState(0);
  const [subtotal, setSubtotal] = React.useState(0);

  React.useEffect(() => {
    const update = () => {
      const cart = readCart(slug);
      setCount(cartCount(cart));
      setSubtotal(cartSubtotalCents(cart));
    };
    update();
    const onCart = () => update();
    const onStorage = (e: StorageEvent) => {
      if (e.key === `rp_cart_${slug}`) update();
    };
    window.addEventListener("cart:changed", onCart as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("cart:changed", onCart as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, [slug]);

  if (count === 0) return null;

  return (
    <>
      <div
        aria-hidden
        className="md:hidden h-24"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      />
      <div
        className="md:hidden fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 bg-gradient-to-t from-surface-50 via-surface-50/95 to-transparent pointer-events-none"
      >
        <Link
          href={`/r/${slug}/checkout`}
          aria-disabled={!orderingOpen}
          tabIndex={orderingOpen ? 0 : -1}
          className={`pointer-events-auto flex h-14 items-center gap-3 rounded-full bg-brand pl-5 pr-3 text-brand-fg shadow-elevated active:scale-[0.99] transition ${
            !orderingOpen ? "opacity-60 pointer-events-none" : ""
          }`}
          onClick={(e) => {
            if (!orderingOpen) e.preventDefault();
          }}
        >
          <span className="grid h-9 w-9 place-items-center rounded-full bg-white/20 shrink-0">
            <ShoppingBag className="h-4 w-4" />
          </span>
          <span className="flex-1 flex items-baseline gap-2 min-w-0">
            <span className="font-medium">
              {count} item{count === 1 ? "" : "s"}
            </span>
            <span className="text-sm text-brand-fg/80 truncate">· Review &amp; checkout</span>
          </span>
          <span className="font-mono tabular-nums font-semibold shrink-0">
            {formatMoney(subtotal)}
          </span>
          <span className="grid h-9 w-9 place-items-center rounded-full bg-white/20 shrink-0">
            <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      </div>
    </>
  );
}
