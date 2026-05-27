"use client";

import * as React from "react";
import { Phone, MapPin, Share2, Check } from "lucide-react";
import { toast } from "sonner";

interface OrderActionsProps {
  phone: string;
  address: string;
  city: string | null;
  state: string | null;
  restaurantName: string;
  orderNumber: number;
  orderUrl: string;
}

export function OrderActions({
  phone,
  address,
  city,
  state,
  restaurantName,
  orderNumber,
  orderUrl,
}: OrderActionsProps) {
  const [copied, setCopied] = React.useState(false);
  const directionsUrl = buildDirectionsUrl(address, city, state);

  async function share() {
    const shareData = {
      title: `Order #${orderNumber} at ${restaurantName}`,
      text: `My order from ${restaurantName} is on the way.`,
      url: orderUrl,
    };
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (e) {
        // User cancelled — silent.
        if ((e as Error).name === "AbortError") return;
      }
    }
    // Fallback: copy link to clipboard
    try {
      await navigator.clipboard.writeText(orderUrl);
      setCopied(true);
      toast.success("Order link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy link");
    }
  }

  return (
    <div className="mt-6 grid grid-cols-3 gap-2">
      <ActionButton
        href={`tel:${phone.replace(/[^\d+]/g, "")}`}
        icon={<Phone className="h-5 w-5" />}
        label="Call"
      />
      <ActionButton
        href={directionsUrl}
        target="_blank"
        rel="noreferrer"
        icon={<MapPin className="h-5 w-5" />}
        label="Directions"
      />
      <button
        type="button"
        onClick={share}
        className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-surface-200 bg-white py-4 text-sm font-medium text-surface-900 hover:border-surface-300 hover:shadow-soft transition active:scale-[0.98]"
      >
        {copied ? (
          <Check className="h-5 w-5 text-emerald-600" />
        ) : (
          <Share2 className="h-5 w-5" />
        )}
        {copied ? "Copied" : "Share"}
      </button>
    </div>
  );
}

function ActionButton({
  href,
  icon,
  label,
  ...rest
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      href={href}
      {...rest}
      className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-surface-200 bg-white py-4 text-sm font-medium text-surface-900 hover:border-surface-300 hover:shadow-soft transition active:scale-[0.98]"
    >
      {icon}
      {label}
    </a>
  );
}

function buildDirectionsUrl(
  address: string,
  city: string | null,
  state: string | null
): string {
  const q = encodeURIComponent(
    [address, city, state].filter(Boolean).join(", ")
  );
  // The maps:// scheme deep-links into Apple Maps on iOS; Google Maps universal
  // URL is the safe fallback everywhere else (it also opens the native app on
  // Android via the OS app-link intent).
  if (typeof navigator !== "undefined" && /iP(hone|ad|od)/.test(navigator.userAgent)) {
    return `https://maps.apple.com/?q=${q}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}
