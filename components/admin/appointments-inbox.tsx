"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarClock,
  Mail,
  Phone,
  Loader2,
  CheckCircle2,
  XCircle,
  Trash2,
  Inbox,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteAppointment,
  updateAppointmentNotes,
  updateAppointmentStatus,
} from "@/app/r/[slug]/admin/(panel)/booking-actions";

interface ApptRow {
  id: string;
  startsAt: string;
  endsAt: string;
  serviceName: string | null;
  serviceDurationMinutes: number | null;
  status: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  notes: string | null;
  adminNotes: string | null;
  createdAt: string;
}

interface Props {
  slug: string;
  appointments: ApptRow[];
}

const STATUSES = [
  { key: "pending", label: "Pending", tone: "bg-sky-50 text-sky-700 ring-sky-200" },
  { key: "confirmed", label: "Confirmed", tone: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  { key: "completed", label: "Completed", tone: "bg-surface-100 text-surface-700 ring-surface-200" },
  { key: "declined", label: "Declined", tone: "bg-red-50 text-red-700 ring-red-200" },
  { key: "cancelled", label: "Cancelled", tone: "bg-amber-50 text-amber-700 ring-amber-200" },
  { key: "no_show", label: "No-show", tone: "bg-red-50 text-red-700 ring-red-200" },
] as const;

type StatusKey = (typeof STATUSES)[number]["key"];

export function AppointmentsInbox({ slug, appointments }: Props) {
  const [filter, setFilter] = React.useState<"upcoming" | "all" | StatusKey>(
    "upcoming"
  );

  const now = new Date();
  const counts: Record<string, number> = {
    upcoming: appointments.filter(
      (a) =>
        new Date(a.startsAt) >= now &&
        a.status !== "cancelled" &&
        a.status !== "declined"
    ).length,
    all: appointments.length,
  };
  for (const s of STATUSES) {
    counts[s.key] = appointments.filter((a) => a.status === s.key).length;
  }

  const filtered = (() => {
    if (filter === "upcoming") {
      return appointments
        .filter(
          (a) =>
            new Date(a.startsAt) >= now &&
            a.status !== "cancelled" &&
            a.status !== "declined"
        )
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    }
    if (filter === "all") return appointments;
    return appointments.filter((a) => a.status === filter);
  })();

  return (
    <>
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-brand mb-2">
          <CalendarClock className="h-3.5 w-3.5" /> Appointments
        </div>
        <h1 className="font-display text-4xl text-surface-900">
          Booking inbox
        </h1>
        <p className="text-sm text-surface-500 mt-1">
          Bookings from your public site. Confirm or decline — customers see
          their status next time they check.
        </p>
      </div>

      <div className="flex gap-1.5 flex-wrap mb-5">
        <FilterChip
          label={`Upcoming (${counts.upcoming})`}
          active={filter === "upcoming"}
          onClick={() => setFilter("upcoming")}
        />
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
            {appointments.length === 0 ? "No bookings yet" : "Nothing here"}
          </h2>
          <p className="mt-1 text-sm text-surface-500 max-w-md mx-auto">
            {appointments.length === 0
              ? "When customers book through your public site, you'll see them here."
              : "Try a different filter."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((a) => (
            <AppointmentCard key={a.id} slug={slug} appt={a} />
          ))}
        </ul>
      )}
    </>
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

function AppointmentCard({ slug, appt }: { slug: string; appt: ApptRow }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(appt.status === "pending");
  const [notes, setNotes] = React.useState(appt.adminNotes ?? "");
  const [savingNotes, setSavingNotes] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const statusMeta =
    STATUSES.find((s) => s.key === appt.status) ?? STATUSES[0];
  const starts = new Date(appt.startsAt);

  async function setStatus(s: StatusKey) {
    setBusy(true);
    try {
      const res = await updateAppointmentStatus({ slug, id: appt.id, status: s });
      if (res.ok) {
        toast.success(`Marked ${s}`);
        router.refresh();
      } else {
        toast.error("Update failed");
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveNotes() {
    if (savingNotes) return;
    setSavingNotes(true);
    try {
      const res = await updateAppointmentNotes({ slug, id: appt.id, notes });
      if (res.ok) {
        toast.success("Notes saved");
        router.refresh();
      }
    } finally {
      setSavingNotes(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this appointment record?")) return;
    setBusy(true);
    try {
      const res = await deleteAppointment({ slug, id: appt.id });
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
        "rounded-2xl border bg-white shadow-soft overflow-hidden",
        appt.status === "pending" ? "border-sky-200" : "border-surface-200"
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-surface-50/60"
      >
        <div className="h-12 w-12 grid place-items-center rounded-xl bg-brand/10 text-brand shrink-0 text-center">
          <div className="leading-none">
            <div className="text-[10px] uppercase tracking-wider">
              {starts.toLocaleDateString(undefined, { month: "short" })}
            </div>
            <div className="font-display text-lg tabular-nums">
              {starts.getDate()}
            </div>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-surface-900 truncate">
              {appt.customerName}
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset uppercase tracking-wider",
                statusMeta.tone
              )}
            >
              {statusMeta.label}
            </span>
          </div>
          <div className="text-xs text-surface-500 mt-0.5">
            {starts.toLocaleString(undefined, {
              weekday: "short",
              hour: "numeric",
              minute: "2-digit",
            })}
            {appt.serviceName ? ` · ${appt.serviceName}` : ""}
            {appt.serviceDurationMinutes
              ? ` · ${appt.serviceDurationMinutes} min`
              : ""}
          </div>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-surface-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-surface-400" />
        )}
      </button>

      {open && (
        <div className="border-t border-surface-100 px-5 py-5 grid gap-4 bg-surface-50/30">
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            {appt.customerEmail && (
              <a
                href={`mailto:${appt.customerEmail}?subject=Your appointment&body=Hi ${encodeURIComponent(appt.customerName)},`}
                className="inline-flex items-center gap-2 text-surface-700 hover:text-brand"
              >
                <Mail className="h-3.5 w-3.5 text-surface-400" />
                {appt.customerEmail}
              </a>
            )}
            {appt.customerPhone && (
              <a
                href={`tel:${appt.customerPhone}`}
                className="inline-flex items-center gap-2 text-surface-700 hover:text-brand"
              >
                <Phone className="h-3.5 w-3.5 text-surface-400" />
                {appt.customerPhone}
              </a>
            )}
          </div>

          {appt.notes && (
            <div className="rounded-xl bg-white ring-1 ring-surface-200 p-4 text-sm text-surface-800 whitespace-pre-wrap">
              <div className="text-[10px] uppercase tracking-wider text-surface-500 mb-1">
                Customer note
              </div>
              {appt.notes}
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor={`an-${appt.id}`} className="text-xs">
              Your notes
            </Label>
            <Textarea
              id={`an-${appt.id}`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Allergies, requests, follow-up plan…"
              className="text-sm"
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={saveNotes}
                disabled={savingNotes || notes === (appt.adminNotes ?? "")}
              >
                {savingNotes && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save notes
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-surface-200">
            <div className="flex gap-1.5 flex-wrap">
              {appt.status === "pending" && (
                <>
                  <Button
                    size="sm"
                    onClick={() => setStatus("confirmed")}
                    disabled={busy}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Confirm
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setStatus("declined")}
                    disabled={busy}
                  >
                    <XCircle className="h-3.5 w-3.5" /> Decline
                  </Button>
                </>
              )}
              {appt.status === "confirmed" && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setStatus("completed")}
                    disabled={busy}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Mark completed
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setStatus("no_show")}
                    disabled={busy}
                  >
                    Mark no-show
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setStatus("cancelled")}
                    disabled={busy}
                  >
                    Cancel
                  </Button>
                </>
              )}
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
