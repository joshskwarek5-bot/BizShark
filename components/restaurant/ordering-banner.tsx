import Link from "next/link";
import { Pause, Clock, Phone } from "lucide-react";
import type { OrderingStatus } from "@/lib/ordering";

export function OrderingBanner({
  status,
  phone,
  slug: _slug,
}: {
  status: OrderingStatus;
  phone: string;
  slug: string;
}) {
  if (status.ok) return null;
  const Icon = status.reason === "paused" ? Pause : Clock;

  return (
    <div className="border-b border-amber-200 bg-amber-50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2.5 text-sm text-amber-900">
          <Icon className="h-4 w-4 shrink-0 text-amber-700" />
          <span className="font-medium">{status.message}</span>
          <span className="text-amber-700 hidden sm:inline">
            You can still call to place an order.
          </span>
        </div>
        <Link
          href={`tel:${phone.replace(/[^\d+]/g, "")}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-amber-900 px-4 text-xs font-semibold text-amber-50 hover:bg-amber-800 transition"
        >
          <Phone className="h-3.5 w-3.5" /> Call {phone}
        </Link>
      </div>
    </div>
  );
}
