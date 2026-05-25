"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  PIPELINE_COLUMNS,
  leadStatusLabel,
  leadStatusTone,
  type LeadStatus,
} from "@/lib/lead-status";
import {
  deleteLead,
  updateLeadNotes,
  updateLeadStatus,
} from "@/app/app/leads/actions";

interface Props {
  id: string;
  initialStatus: string;
  initialNotes: string | null;
}

export function LeadDetailControls({ id, initialStatus, initialNotes }: Props) {
  const router = useRouter();
  const [status, setStatus] = React.useState<string>(initialStatus);
  const [notes, setNotes] = React.useState(initialNotes ?? "");
  const [savingStatus, setSavingStatus] = React.useState<string | null>(null);
  const [savingNotes, setSavingNotes] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [notesDirty, setNotesDirty] = React.useState(false);

  async function pickStatus(next: LeadStatus) {
    if (next === status) return;
    setSavingStatus(next);
    try {
      const res = await updateLeadStatus({ id, status: next });
      if (res.ok) {
        setStatus(next);
        toast.success(`Moved to ${leadStatusLabel(next)}`);
        router.refresh();
      } else {
        toast.error("error" in res ? res.error : "Could not update");
      }
    } finally {
      setSavingStatus(null);
    }
  }

  async function saveNotes() {
    if (!notesDirty || savingNotes) return;
    setSavingNotes(true);
    try {
      const res = await updateLeadNotes({ id, notes: notes.trim() || null });
      if (res.ok) {
        setNotesDirty(false);
        toast.success("Notes saved");
        router.refresh();
      }
    } finally {
      setSavingNotes(false);
    }
  }

  async function onDelete() {
    if (!confirm("Delete this lead permanently?")) return;
    setDeleting(true);
    try {
      const res = await deleteLead({ id });
      if (res.ok) {
        toast.success("Lead deleted");
        router.push("/app/leads");
      } else {
        toast.error("error" in res ? res.error : "Could not delete");
        setDeleting(false);
      }
    } catch {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-surface-200 bg-white p-5">
        <div className="text-xs font-medium uppercase tracking-wider text-surface-500 mb-3">
          Pipeline status
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
          {PIPELINE_COLUMNS.map((s) => {
            const tone = leadStatusTone(s);
            const active = s === status;
            const saving = savingStatus === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => pickStatus(s)}
                disabled={saving}
                className={cn(
                  "rounded-xl px-3 py-2.5 text-xs font-medium border transition text-center",
                  active
                    ? `${tone.bg} ${tone.text} ring-2 ring-inset ${tone.ring} border-transparent`
                    : "bg-surface-50 text-surface-600 border-surface-200 hover:bg-surface-100"
                )}
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin inline" />
                ) : (
                  leadStatusLabel(s)
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-surface-200 bg-white p-5">
        <div className="flex items-center justify-between mb-3">
          <Label htmlFor="lead-notes" className="text-xs font-medium uppercase tracking-wider">
            Notes
          </Label>
          {notesDirty && (
            <span className="text-xs text-amber-700">Unsaved</span>
          )}
        </div>
        <Textarea
          id="lead-notes"
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            setNotesDirty(true);
          }}
          onBlur={saveNotes}
          rows={6}
          placeholder="Owner's name, what you've sent, next steps, prior calls…"
          className="text-sm"
        />
        <div className="flex justify-end mt-3">
          <Button
            type="button"
            onClick={saveNotes}
            disabled={!notesDirty || savingNotes}
            size="sm"
          >
            {savingNotes && <Loader2 className="h-4 w-4 animate-spin" />}
            Save notes
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-red-200 bg-red-50/50 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-red-900">Delete lead</div>
            <p className="text-xs text-red-700 mt-0.5">
              Permanently removes this prospect from your pipeline.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDelete}
            disabled={deleting}
            className="text-red-700 hover:bg-red-100"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete
          </Button>
        </div>
      </section>
    </div>
  );
}
