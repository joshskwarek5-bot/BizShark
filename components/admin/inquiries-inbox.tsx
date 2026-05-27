"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Mail,
  Phone,
  Clock,
  MapPin,
  CalendarClock,
  MessageSquareQuote,
  CheckCircle2,
  Trash2,
  Loader2,
  Inbox,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteInquiry,
  updateInquiryNotes,
  updateInquiryStatus,
} from "@/app/r/[slug]/admin/(panel)/inquiries/actions";

interface InquiryRow {
  id: string;
  kind: string;
  status: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  message: string | null;
  serviceRequested: string | null;
  preferredDate: string | null;
  preferredTime: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
}

interface Props {
  slug: string;
  inquiries: InquiryRow[];
}

const STATUSES = [
  { key: "new", label: "New", tone: "bg-sky-50 text-sky-700 ring-sky-200" },
  { key: "contacted", label: "Contacted", tone: "bg-amber-50 text-amber-700 ring-amber-200" },
  { key: "quoted", label: "Quoted", tone: "bg-violet-50 text-violet-700 ring-violet-200" },
  { key: "scheduled", label: "Scheduled", tone: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  { key: "closed", label: "Closed", tone: "bg-surface-100 text-surface-700 ring-surface-200" },
  { key: "spam", label: "Spam", tone: "bg-red-50 text-red-700 ring-red-200" },
] as const;

type StatusKey = (typeof STATUSES)[number]["key"];

const KIND_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  quote: {
    label: "Quote request",
    icon: MessageSquareQuote,
    tone: "bg-brand/10 text-brand",
  },
  appointment: {
    label: "Appointment request",
    icon: CalendarClock,
    tone: "bg-sky-100 text-sky-700",
  },
  contact: { label: "Contact message", icon: Mail, tone: "bg-surface-100 text-surface-700" },
};

export function InquiriesInbox({ slug, inquiries }: Props) {
  const [filter, setFilter] = React.useState<"all" | StatusKey>("all");
  const counts = React.useMemo(() => {
    const c: Record<string, number> = { all: inquiries.length };
    for (const s of STATUSES) {
      c[s.key] = inquiries.filter((i) => i.status === s.key).length;
    }
    return c;
  }, [inquiries]);

  const filtered =
    filter === "all" ? inquiries : inquiries.filter((i) => i.status === filter);

  return (
    <div className="space-y-5">
      {/* Filter chips */}
      <div className="flex gap-1.5 flex-wrap">
        <FilterChip
          label={`All (${counts.all})`}
          active={filter === "all"}
          onClick={() => setFilter("all")}
        />
        {STATUSES.map((s) => (
          <FilterChip
            key={s.key}
            label={`${s.label} (${counts[s.key] ?? 0})`}
            active={filter === s.key}
            onClick={() => setFilter(s.key)}
          />
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-surface-300 bg-white/60 p-16 text-center">
          <Inbox className="h-10 w-10 mx-auto text-surface-400" />
          <h2 className="mt-4 font-display text-2xl text-surface-900">
            {inquiries.length === 0 ? "No inquiries yet" : "Nothing here"}
          </h2>
          <p className="mt-1 text-sm text-surface-500 max-w-md mx-auto">
            {inquiries.length === 0
              ? "When customers fill out a contact form or request a quote on your site, you'll see them here."
              : "Try a different filter."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((inq) => (
            <InquiryCard key={inq.id} slug={slug} inq={inq} />
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3.5 py-1.5 text-xs font-medium transition",
        active
          ? "bg-brand text-brand-fg shadow-soft"
          : "bg-surface-100 text-surface-700 hover:bg-surface-200"
      )}
    >
      {label}
    </button>
  );
}

function InquiryCard({ slug, inq }: { slug: string; inq: InquiryRow }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(inq.status === "new");
  const [notes, setNotes] = React.useState(inq.notes ?? "");
  const [savingNotes, setSavingNotes] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const kindMeta = KIND_META[inq.kind] ?? KIND_META.contact;
  const KindIcon = kindMeta.icon;
  const statusMeta = STATUSES.find((s) => s.key === inq.status) ?? STATUSES[0];

  async function setStatus(s: StatusKey) {
    setBusy(true);
    try {
      const res = await updateInquiryStatus({ slug, id: inq.id, status: s });
      if (res.ok) {
        toast.success(`Marked as ${s}`);
        router.refresh();
      } else {
        toast.error("Could not update");
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveNotes() {
    if (savingNotes) return;
    setSavingNotes(true);
    try {
      const res = await updateInquiryNotes({ slug, id: inq.id, notes });
      if (res.ok) {
        toast.success("Notes saved");
        router.refresh();
      }
    } finally {
      setSavingNotes(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this inquiry?")) return;
    setBusy(true);
    try {
      const res = await deleteInquiry({ slug, id: inq.id });
      if (res.ok) {
        toast.success("Deleted");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <li
      className={cn(
        "rounded-2xl border bg-white shadow-soft overflow-hidden transition",
        inq.status === "new" ? "border-sky-200" : "border-surface-200"
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-surface-50/60"
      >
        <div className={cn("h-10 w-10 grid place-items-center rounded-full shrink-0", kindMeta.tone)}>
          <KindIcon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-surface-900 truncate">
              {inq.customerName}
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset uppercase tracking-wider",
                statusMeta.tone
              )}
            >
              {statusMeta.label}
            </span>
            <span className="text-[11px] text-surface-500">· {kindMeta.label}</span>
          </div>
          <div className="text-xs text-surface-500 mt-0.5 truncate">
            {inq.serviceRequested && <>{inq.serviceRequested} · </>}
            {new Date(inq.createdAt).toLocaleString()}
          </div>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-surface-400 shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-surface-400 shrink-0" />
        )}
      </button>

      {open && (
        <div className="border-t border-surface-100 px-5 py-5 grid gap-4 bg-surface-50/30">
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            {inq.customerEmail && (
              <a
                href={`mailto:${inq.customerEmail}`}
                className="inline-flex items-center gap-2 text-surface-700 hover:text-brand"
              >
                <Mail className="h-3.5 w-3.5 text-surface-400" />
                {inq.customerEmail}
              </a>
            )}
            {inq.customerPhone && (
              <a
                href={`tel:${inq.customerPhone}`}
                className="inline-flex items-center gap-2 text-surface-700 hover:text-brand"
              >
                <Phone className="h-3.5 w-3.5 text-surface-400" />
                {inq.customerPhone}
              </a>
            )}
            {(inq.preferredDate || inq.preferredTime) && (
              <div className="inline-flex items-center gap-2 text-surface-700">
                <Clock className="h-3.5 w-3.5 text-surface-400" />
                {inq.preferredDate} {inq.preferredTime}
              </div>
            )}
            {inq.address && (
              <div className="inline-flex items-center gap-2 text-surface-700">
                <MapPin className="h-3.5 w-3.5 text-surface-400" />
                {inq.address}
              </div>
            )}
          </div>

          {inq.message && (
            <div className="rounded-xl bg-white ring-1 ring-surface-200 p-4 text-sm text-surface-800 whitespace-pre-wrap">
              {inq.message}
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor={`notes-${inq.id}`} className="text-xs">
              Your notes
            </Label>
            <Textarea
              id={`notes-${inq.id}`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Followed up by phone on 5/26, gave quote of $300…"
              className="text-sm"
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={saveNotes}
                disabled={savingNotes || notes === (inq.notes ?? "")}
              >
                {savingNotes && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save notes
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-surface-200">
            <div className="flex gap-1.5 flex-wrap">
              {STATUSES.filter((s) => s.key !== inq.status).map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setStatus(s.key)}
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded-full bg-surface-100 hover:bg-surface-200 px-2.5 py-1 text-[11px] font-medium text-surface-700 transition disabled:opacity-50"
                >
                  {s.key === "scheduled" || s.key === "quoted" ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : null}
                  Mark {s.label.toLowerCase()}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="inline-flex items-center gap-1 text-[11px] text-red-700 hover:underline disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3" /> Delete
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
