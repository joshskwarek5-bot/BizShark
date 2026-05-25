// Cart is stored client-side in localStorage, scoped per restaurant slug.
// We re-validate every line item against the live menu at checkout time
// to defend against price drift / disabled items.

export interface CartLine {
  itemId: string;
  name: string;
  priceCents: number;
  quantity: number;
  notes?: string;
}

export type Cart = Record<string, CartLine>; // keyed by itemId

const KEY_PREFIX = "rp_cart_";

export function cartKey(slug: string): string {
  return `${KEY_PREFIX}${slug}`;
}

export function readCart(slug: string): Cart {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(cartKey(slug));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

export function writeCart(slug: string, cart: Cart) {
  if (typeof window === "undefined") return;
  localStorage.setItem(cartKey(slug), JSON.stringify(cart));
  // Notify same-tab listeners (storage event only fires on other tabs)
  window.dispatchEvent(new CustomEvent("cart:changed", { detail: { slug } }));
}

export function clearCart(slug: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(cartKey(slug));
  window.dispatchEvent(new CustomEvent("cart:changed", { detail: { slug } }));
}

export function cartCount(cart: Cart): number {
  return Object.values(cart).reduce((acc, l) => acc + l.quantity, 0);
}

export function cartSubtotalCents(cart: Cart): number {
  return Object.values(cart).reduce((acc, l) => acc + l.priceCents * l.quantity, 0);
}
