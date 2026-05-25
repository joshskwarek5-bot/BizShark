"use client";

import * as React from "react";
import Link from "next/link";
import { Search, MapPin, Phone, Star, Plus } from "lucide-react";
import { LeadSearchDialog } from "./lead-search-dialog";
import {
  PIPELINE_COLUMNS,
  leadStatusLabel,
  leadStatusTone,
  type LeadStatus,
} from "@/lib/lead-status";

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
}

export function LeadPipeline({
  leads,
  defaultCity,
  defaultState,
  hasApiKey,
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

  if (leads.length === 0) {
    return (
      <>
        <div className="rounded-3xl border border-dashed border-surface-300 bg-white/60 p-12 text-center">
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
            className="inline-flex h-12 mt-6 items-center gap-2 rounded-full bg-brand pl-6 pr-4 text-sm font-medium text-brand-fg shadow-soft active:scale-[0.98] transition"
          >
            <Search className="h-4 w-4" />
            Find leads
          </button>
        </div>
        <LeadSearchDialog
          open={searchOpen}
          onOpenChange={setSearchOpen}
          defaultCity={defaultCity}
          defaultState={defaultState}
          hasApiKey={hasApiKey}
        />
      </>
    );
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-medium text-brand-fg shadow-soft active:scale-[0.98] transition"
        >
          <Plus className="h-4 w-4" />
          Find more leads
        </button>
      </div>
      <div className="grid gap-3 lg:grid-cols-5 sm:grid-cols-2">
        {PIPELINE_COLUMNS.map((col) => (
          <Column key={col} status={col} leads={byStatus[col]} />
        ))}
      </div>
      <LeadSearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        defaultCity={defaultCity}
        defaultState={defaultState}
        hasApiKey={hasApiKey}
      />
    </>
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
          leads.map((lead) => <LeadCard key={lead.id} lead={lead} />)
        )}
      </div>
    </div>
  );
}

function LeadCard({ lead }: { lead: LeadCard }) {
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
