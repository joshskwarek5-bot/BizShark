export const ORDER_STATUSES = [
  "new",
  "preparing",
  "ready",
  "completed",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export function statusLabel(s: string): string {
  switch (s) {
    case "new":
      return "Order received";
    case "preparing":
      return "Preparing";
    case "ready":
      return "Ready for pickup";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return s;
  }
}

export function statusTone(s: string): {
  bg: string;
  text: string;
  dot: string;
  ring: string;
} {
  switch (s) {
    case "new":
      return { bg: "bg-sky-50", text: "text-sky-700", dot: "bg-sky-500", ring: "ring-sky-200" };
    case "preparing":
      return {
        bg: "bg-amber-50",
        text: "text-amber-700",
        dot: "bg-amber-500",
        ring: "ring-amber-200",
      };
    case "ready":
      return {
        bg: "bg-emerald-50",
        text: "text-emerald-700",
        dot: "bg-emerald-500",
        ring: "ring-emerald-200",
      };
    case "completed":
      return {
        bg: "bg-surface-100",
        text: "text-surface-700",
        dot: "bg-surface-500",
        ring: "ring-surface-200",
      };
    case "cancelled":
      return {
        bg: "bg-red-50",
        text: "text-red-700",
        dot: "bg-red-500",
        ring: "ring-red-200",
      };
    default:
      return {
        bg: "bg-surface-100",
        text: "text-surface-700",
        dot: "bg-surface-500",
        ring: "ring-surface-200",
      };
  }
}
