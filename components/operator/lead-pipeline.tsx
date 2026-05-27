"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Search,
  MapPin,
  Phone,
  Star,
  Plus,
  TrendingUp,
  Trash2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LeadCapacity } from "@/lib/subscriptions";
import { Button } from "@/components/ui/button";
import { LeadSearchDialog } from "./lead-search-dialog";
import {
  PIPELINE_COLUMNS,
  leadStatusLabel,
  leadStatusTone,
  type LeadStatus,
} from "@/lib/lead-status";
import { deleteClosedLeads } from "@/app/app/leads/actions";

interface LeadCard {
  id: string;
  businessName: string;
  businessType: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  rating: number | null;
  reviewCount: number | null;
  status: string;
}

interface LeadPipelineProps {
  leads: LeadCard[];
  defaultCity: string | null;
  defaultState: string | null;
  hasApiKey: boolean;
  capacity: LeadCapacity;
  tierName: string;
}

export function LeadPipeline({
  leads,
  defaultCity,
  defaultState,
  hasApiKey,
  capacity,
  tierName,
}: LeadPipelineProps) {
  const [searchOpen, setSearchOpen] = React.useState(false);

  const byStatus = React.useMemo(() => {
    const map: Record<LeadStatus, LeadCard[]> = {
      new: [],
      contacted: [],
      qualified: [],
      closed_won: [],
      closed_lost: [],
    };
    for (const l of leads) {
      const s = (l.status as LeadStatus) ?? "new";
      if (map[s]) map[s].push(l);
      else map.new.push(l);
    }
    return map;
  }, [leads]);

  const closedCount =
    byStatus.closed_won.length + byStatus.closed_lost.length;

  return (
    <>
      <CapacityBar
        capacity={capacity}
        tierName={tierName}
        closedCount={closedCount}
        onFindLeads={() => setSearchOpen(true)}
      />

      {leads.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-surface-300 bg-white/60 p-12 text-center mt-6">
          <div className="mx-auto h-12 w-12 grid place-items-center rounded-full bg-brand/10 text-brand">
            <Search className="h-6 w-6" />
          </div>
          <h2 className="mt-4 font-display text-3xl text-surface-900">No leads yet</h2>
          <p className="mt-2 text-surface-600 max-w-md mx-auto">
            Run your first search to find local businesses without websites — your
            highest-value prospects.
          </p>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            disabled={capacity.state === "full"}
            className="inline-flex h-12 mt-6 items-center gap-2 rounded-full bg-brand pl-6 pr-4 text-sm font-medium text-brand-fg shadow-soft active:scale-[0.98] transition disabled:opacity-50"
          >
            <Search className="h-4 w-4" />
            Find leads
          </button>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-5 sm:grid-cols-2 mt-6">
          {PIPELINE_COLUMNS.map((col) => (
            <Column key={col} status={col} leads={byStatus[col]} />
          ))}
        </div>
      )}

      <LeadSearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        defaultCity={defaultCity}
        defaultState={defaultState}
        hasApiKey={hasApiKey}
        capacity={capacity}
        tierName={tierName}
      />
    </>
  );
}

function CapacityBar({
  capacity,
  tierName,
  closedCount,
  onFindLeads,
}: {
  capacity: LeadCapacity;
  tierName: string;
  closedCount: number;
  onFindLeads: () => void;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = React.useState(false);

  async function freeClosed() {
    if (closedCount === 0 || deleting) return;
    if (
      !confirm(
        `Delete ${closedCount} closed lead${closedCount === 1 ? "" : "s"} (won + lost) to free up capacity?`
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      const res = await deleteClosedLeads({ kind: "all_closed" });
      if (res.ok) {
        toast.success(`Freed ${res.deleted} slot${res.deleted === 1 ? "" : "s"}`);
        router.refresh();
      } else {
        toast.error("Could not free");
      }
    } finally {
      setDeleting(false);
    }
  }

  const isFull = capacity.state === "full";
  const isWarning = capacity.state === "warning";

  return (
    <div
      className={cn(
        "rounded-3xl border shadow-soft p-5 md:p-6 flex items-center gap-5 flex-wrap",
        isFull
          ? "border-red-200 bg-gradient-to-br from-red-50 via-white to-white"
          : isWarning
            ? "border-amber-200 bg-gradient-to-br from-amber-50 via-white to-white"
            : "border-surface-200 bg-white"
      )}
    >
      <div className="flex-1 min-w-[260px]">
        <div className="flex items-baseline justify-between gap-2 mb-1.5">
          <div className="flex items-baseline gap-1.5">
            <span
              className={cn(
                "font-display tabular-nums text-3xl",
                isFull ? "text-red-700" : isWarning ? "text-amber-700" : "text-surface-900"
              )}
            >
              {capacity.used}
            </span>
            <span className="text-sm text-surface-500">
              / {capacity.cap} leads on {tierName}
            </span>
          </div>
          <span
            className={cn(
              "text-xs font-medium uppercase tracking-wider tabular-nums",
              isFull
                ? "text-red-700"
                : isWarning
                  ? "text-amber-700"
                  : "text-surface-500"
            )}
          >
            {capacity.remaining} left
          </span>
        </div>
        <div className="h-2 rounded-full bg-surface-100 overflow-hidden">
          <div
            className={cn(
              "h-full transition-all duration-500",
              isFull ? "bg-red-500" : isWarning ? "bg-amber-500" : "bg-brand"
            )}
            style={{ width: `${capacity.pct}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-surface-500">
          {isFull
            ? "You're at your cap. Delete some closed leads or upgrade to find more."
            : isWarning
              ? `Almost at your cap — only ${capacity.remaining} slot${capacity.remaining === 1 ? "" : "s"} left before you need to upgrade or delete.`
              : "Deleting leads frees slots. Closed_won and closed_lost still count — clean them out when done."}
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {closedCount > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={freeClosed}
            disabled={deleting}
          >
            {deleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            Free {closedCount} closed
          </Button>
        )}
        {(isFull || isWarning) && (
          <Button asChild variant="outline" size="sm">
            <Link href="/app/billing">
              <TrendingUp className="h-3.5 w-3.5" /> Upgrade plan
            </Link>
          </Button>
        )}
        <Button
          type="button"
          onClick={onFindLeads}
          disabled={isFull}
          size="sm"
        >
          <Plus className="h-4 w-4" /> Find leads
        </Button>
      </div>
    </div>
  );
}

function Column({ status, leads }: { status: LeadStatus; leads: LeadCard[] }) {
  const tone = leadStatusTone(status);
  return (
    <div className="rounded-2xl bg-surface-100/60 p-3">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-1.5">
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${tone.dot}`} />
          <span className="text-xs font-semibold uppercase tracking-wider text-surface-700">
            {leadStatusLabel(status)}
          </span>
        </div>
        <span className="text-xs font-mono text-surface-500 tabular-nums">
          {leads.length}
        </span>
      </div>
      <div className="space-y-2">
        {leads.length === 0 ? (
          <div className="rounded-xl border border-dashed border-surface-300 bg-white/40 py-6 text-center text-xs text-surface-400">
            Empty
          </div>
        ) : (
          leads.map((lead) => <LeadCardRow key={lead.id} lead={lead} />)
        )}
      </div>
    </div>
  );
}

function LeadCardRow({ lead }: { lead: LeadCard }) {
  return (
    <Link
      href={`/app/leads/${lead.id}`}
      className="block rounded-xl bg-white p-3 shadow-soft hover:shadow-elevated border border-transparent hover:border-brand/30 transition-all"
    >
      <div className="font-medium text-surface-900 text-sm truncate">
        {lead.businessName}
      </div>
      {lead.businessType && (
        <div className="text-xs text-surface-500 mt-0.5 truncate capitalize">
          {lead.businessType.replace(/_/g, " ")}
        </div>
      )}
      <div className="mt-2 space-y-1 text-xs text-surface-600">
        {lead.city && (
          <div className="flex items-center gap-1.5 truncate">
            <MapPin className="h-3 w-3 text-surface-400 shrink-0" />
            {lead.city}
            {lead.state ? `, ${lead.state}` : ""}
          </div>
        )}
        {lead.phone && (
          <div className="flex items-center gap-1.5 truncate">
            <Phone className="h-3 w-3 text-surface-400 shrink-0" />
            {lead.phone}
          </div>
        )}
        {lead.rating !== null && (
          <div className="flex items-center gap-1.5">
            <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
            <span className="font-mono tabular-nums">{lead.rating.toFixed(1)}</span>
            {lead.reviewCount !== null && (
              <span className="text-surface-400">({lead.reviewCount})</span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

