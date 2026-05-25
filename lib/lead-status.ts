export const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "closed_won",
  "closed_lost",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export function leadStatusLabel(s: string): string {
  switch (s) {
    case "new":
      return "New";
    case "contacted":
      return "Contacted";
    case "qualified":
      return "Qualified";
    case "closed_won":
      return "Closed (Won)";
    case "closed_lost":
      return "Closed (Lost)";
    default:
      return s;
  }
}

export function leadStatusTone(s: string): {
  bg: string;
  text: string;
  dot: string;
  ring: string;
} {
  switch (s) {
    case "new":
      return { bg: "bg-sky-50", text: "text-sky-700", dot: "bg-sky-500", ring: "ring-sky-200" };
    case "contacted":
      return {
        bg: "bg-amber-50",
        text: "text-amber-700",
        dot: "bg-amber-500",
        ring: "ring-amber-200",
      };
    case "qualified":
      return {
        bg: "bg-violet-50",
        text: "text-violet-700",
        dot: "bg-violet-500",
        ring: "ring-violet-200",
      };
    case "closed_won":
      return {
        bg: "bg-emerald-50",
        text: "text-emerald-700",
        dot: "bg-emerald-500",
        ring: "ring-emerald-200",
      };
    case "closed_lost":
      return {
        bg: "bg-surface-100",
        text: "text-surface-600",
        dot: "bg-surface-400",
        ring: "ring-surface-200",
      };
    default:
      return {
        bg: "bg-surface-100",
        text: "text-surface-600",
        dot: "bg-surface-400",
        ring: "ring-surface-200",
      };
  }
}

/** Pipeline columns in left-to-right display order. */
export const PIPELINE_COLUMNS: LeadStatus[] = [
  "new",
  "contacted",
  "qualified",
  "closed_won",
  "closed_lost",
];
