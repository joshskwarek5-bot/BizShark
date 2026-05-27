"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  Loader2,
  Trash2,
  CalendarClock,
  Check,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogCloseButton,
} from "@/components/ui/dialog";
import {
  createClassSession,
  deleteClassSession,
  updateClassSession,
} from "@/app/r/[slug]/admin/(panel)/vertical-actions";

interface ClassRow {
  id: string;
  name: string;
  description: string | null;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  instructorId: string | null;
  capacity: number | null;
  level: string | null;
  bookingUrl: string | null;
}

interface Instructor {
  id: string;
  name: string;
}

interface Props {
  slug: string;
  classes: ClassRow[];
  instructors: Instructor[];
}

const DAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
] as const;

export function ClassesManager({ slug, classes, instructors }: Props) {
  const router = useRouter();
  const [adding, setAdding] = React.useState<string | null>(null); // day key
  const [editing, setEditing] = React.useState<ClassRow | null>(null);

  const byDay = React.useMemo(() => {
    const map: Record<string, ClassRow[]> = {};
    for (const d of DAYS) map[d.key] = [];
    for (const c of classes) {
      if (map[c.dayOfWeek]) map[c.dayOfWeek].push(c);
    }
    // Sort each day by startTime
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return map;
  }, [classes]);

  const instructorById = React.useMemo(() => {
    const m: Record<string, string> = {};
    for (const i of instructors) m[i.id] = i.name;
    return m;
  }, [instructors]);

  async function onDelete(row: ClassRow) {
    if (!confirm(`Remove ${row.name} on ${row.dayOfWeek}?`)) return;
    const res = await deleteClassSession({ slug, id: row.id });
    if (res.ok) {
      toast.success("Class removed");
      router.refresh();
    } else {
      toast.error("error" in res ? res.error : "Delete failed");
    }
  }

  return (
    <>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="font-display text-4xl text-surface-900">Class schedule</h1>
          <p className="text-sm text-surface-500 mt-1 max-w-2xl">
            Recurring weekly slots. Add as many or as few — the public site
            renders a weekly grid that filters by day.
          </p>
        </div>
        <Button onClick={() => setAdding("mon")}>
          <Plus className="h-4 w-4" /> Add class
        </Button>
      </div>

      {classes.length === 0 && (
        <div className="rounded-3xl border border-dashed border-surface-300 bg-white/60 p-12 text-center mb-6">
          <div className="mx-auto h-12 w-12 grid place-items-center rounded-full bg-brand/10 text-brand">
            <CalendarClock className="h-6 w-6" />
          </div>
          <div className="mt-4 font-display text-2xl text-surface-900">
            No classes scheduled
          </div>
          <p className="mt-1 text-sm text-surface-500 max-w-md mx-auto">
            Add your weekly recurring classes — CrossFit, Yoga, Pilates,
            whatever you offer. Each gets a card on the public site.
          </p>
          <Button className="mt-6" onClick={() => setAdding("mon")}>
            <Plus className="h-4 w-4" /> Add your first class
          </Button>
        </div>
      )}

      {/* Weekly grid */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {DAYS.map((d) => (
          <div key={d.key} className="rounded-2xl bg-surface-100/60 p-3">
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-surface-700">
                {d.label}
              </div>
              <button
                type="button"
                onClick={() => setAdding(d.key)}
                className="h-6 w-6 grid place-items-center rounded-full text-surface-500 hover:bg-surface-200 transition"
                title={`Add class on ${d.label}`}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-2">
              {byDay[d.key].length === 0 ? (
                <div className="text-[11px] text-surface-400 text-center py-4 italic">
                  Empty
                </div>
              ) : (
                byDay[d.key].map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => setEditing(c)}
                    className="w-full text-left rounded-xl bg-white p-2.5 shadow-soft hover:shadow-elevated border border-transparent hover:border-brand/30 transition-all"
                  >
                    <div className="flex items-baseline justify-between gap-1">
                      <span className="text-[11px] font-mono tabular-nums text-surface-500">
                        {c.startTime}–{c.endTime}
                      </span>
                      {c.level && (
                        <span className="text-[9px] uppercase tracking-wider text-surface-400">
                          {c.level}
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-medium text-surface-900 truncate mt-0.5">
                      {c.name}
                    </div>
                    {c.instructorId && instructorById[c.instructorId] && (
                      <div className="text-[11px] text-surface-500 truncate">
                        {instructorById[c.instructorId]}
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      <ClassDialog
        slug={slug}
        open={adding !== null}
        initialDay={adding ?? "mon"}
        instructors={instructors}
        onOpenChange={(o) => !o && setAdding(null)}
        onSaved={() => {
          setAdding(null);
          router.refresh();
        }}
      />
      <ClassDialog
        slug={slug}
        open={!!editing}
        existing={editing ?? undefined}
        instructors={instructors}
        onOpenChange={(o) => !o && setEditing(null)}
        onSaved={() => {
          setEditing(null);
          router.refresh();
        }}
        onDelete={editing ? () => onDelete(editing) : undefined}
      />
    </>
  );
}

function ClassDialog({
  slug,
  open,
  initialDay = "mon",
  existing,
  instructors,
  onOpenChange,
  onSaved,
  onDelete,
}: {
  slug: string;
  open: boolean;
  initialDay?: string;
  existing?: ClassRow;
  instructors: Instructor[];
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
  onDelete?: () => void;
}) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [day, setDay] = React.useState("mon");
  const [start, setStart] = React.useState("09:00");
  const [end, setEnd] = React.useState("10:00");
  const [instructorId, setInstructorId] = React.useState<string>("");
  const [capacity, setCapacity] = React.useState("");
  const [level, setLevel] = React.useState("");
  const [bookingUrl, setBookingUrl] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setName(existing?.name ?? "");
      setDescription(existing?.description ?? "");
      setDay(existing?.dayOfWeek ?? initialDay);
      setStart(existing?.startTime ?? "09:00");
      setEnd(existing?.endTime ?? "10:00");
      setInstructorId(existing?.instructorId ?? "");
      setCapacity(existing?.capacity?.toString() ?? "");
      setLevel(existing?.level ?? "");
      setBookingUrl(existing?.bookingUrl ?? "");
    }
  }, [open, existing, initialDay]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!name.trim()) {
      toast.error("Class name required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        slug,
        name: name.trim(),
        description: description.trim() || null,
        dayOfWeek: day as "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun",
        startTime: start,
        endTime: end,
        instructorId: instructorId || null,
        capacity: capacity ? parseInt(capacity, 10) : null,
        level: level || null,
        bookingUrl: bookingUrl.trim() || null,
      };
      const res = existing
        ? await updateClassSession({ id: existing.id, ...payload })
        : await createClassSession(payload);
      if (res.ok) {
        toast.success(existing ? "Updated" : "Class added");
        onSaved();
      } else {
        toast.error("error" in res ? res.error : "Save failed");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {existing ? "Edit class" : "Add a class"}
          </DialogTitle>
          <DialogDescription>
            Weekly recurring slot — sets the time, instructor, and booking link.
          </DialogDescription>
          <DialogCloseButton />
        </DialogHeader>

        <form onSubmit={onSubmit} className="px-6 pb-6 grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="cl-name">Class name *</Label>
            <Input
              id="cl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="CrossFit / Vinyasa / Reformer Pilates"
              required
              autoFocus
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="cl-desc">Description</Label>
            <Textarea
              id="cl-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What's the vibe? Who's it good for?"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label>Day</Label>
              <select
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className="h-11 rounded-xl border border-surface-200 bg-white px-4 text-sm"
              >
                {DAYS.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cl-start">Start</Label>
              <Input
                id="cl-start"
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cl-end">End</Label>
              <Input
                id="cl-end"
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Instructor</Label>
              <select
                value={instructorId}
                onChange={(e) => setInstructorId(e.target.value)}
                className="h-11 rounded-xl border border-surface-200 bg-white px-4 text-sm"
              >
                <option value="">— Any —</option>
                {instructors.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
              {instructors.length === 0 && (
                <p className="text-[11px] text-surface-500">
                  Add coaches in the Team tab to assign them here.
                </p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label>Level</Label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="h-11 rounded-xl border border-surface-200 bg-white px-4 text-sm"
              >
                <option value="">— Any —</option>
                <option value="all-levels">All levels</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="cl-cap">Capacity</Label>
              <Input
                id="cl-cap"
                type="number"
                min="0"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="20"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cl-book">Booking link</Label>
              <Input
                id="cl-book"
                value={bookingUrl}
                onChange={(e) => setBookingUrl(e.target.value)}
                placeholder="pushpress.com/... or mindbody.com/..."
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-surface-100">
            {onDelete ? (
              <button
                type="button"
                onClick={onDelete}
                className="text-xs text-red-600 hover:underline inline-flex items-center gap-1"
              >
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                {existing ? "Save changes" : "Add class"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _used = [cn, Pencil];
