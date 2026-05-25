import Link from "next/link";
import { Clock, User } from "lucide-react";
import { Order, OrderItem } from "@prisma/client";
import { formatMoney } from "@/lib/utils";
import { statusLabel, statusTone } from "@/lib/order-status";

export function OrderCard({
  slug,
  order,
}: {
  slug: string;
  order: Order & { items: OrderItem[] };
}) {
  const tone = statusTone(order.status);
  const ago = timeAgo(order.createdAt);
  const itemCount = order.items.reduce((acc, i) => acc + i.quantity, 0);
  return (
    <Link
      href={`/r/${slug}/admin/orders/${order.id}`}
      className="group flex flex-col gap-3 rounded-2xl border border-surface-200 bg-white p-5 hover:border-brand/40 hover:shadow-elevated transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-display text-2xl text-surface-900 leading-none">
            #{order.orderNumber}
          </div>
          <div className="mt-1 text-xs text-surface-500">{ago}</div>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${tone.bg} ${tone.text} ${tone.ring}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
          {statusLabel(order.status)}
        </span>
      </div>
      <div className="space-y-1 text-sm">
        <div className="flex items-center gap-2 text-surface-700">
          <User className="h-3.5 w-3.5 text-surface-400" /> {order.customerName}
        </div>
        <div className="flex items-center gap-2 text-surface-700">
          <Clock className="h-3.5 w-3.5 text-surface-400" /> Pickup: {order.pickupTime}
        </div>
      </div>
      <div className="border-t border-surface-100 pt-3 flex items-center justify-between">
        <div className="text-xs text-surface-500">
          {itemCount} item{itemCount === 1 ? "" : "s"}
        </div>
        <div className="font-mono text-sm font-medium text-surface-900 tabular-nums">
          {formatMoney(order.totalCents)}
        </div>
      </div>
    </Link>
  );
}

function timeAgo(date: Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
