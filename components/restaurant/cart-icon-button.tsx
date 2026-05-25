"use client";

import * as React from "react";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { cartCount, readCart } from "@/lib/cart";
import { cn } from "@/lib/utils";

export function CartIconButton({ slug, className }: { slug: string; className?: string }) {
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    const update = () => setCount(cartCount(readCart(slug)));
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

  return (
    <Link
      href={`/r/${slug}/checkout`}
      aria-label={`Cart (${count} items)`}
      className={cn(
        "relative inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-surface-800 shadow-crisp hover:bg-surface-100 transition",
        className
      )}
    >
      <ShoppingBag className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-semibold text-brand-fg shadow-soft">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
