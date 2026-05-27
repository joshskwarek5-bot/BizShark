"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  Loader2,
  Trash2,
  Pencil,
  ExternalLink,
  UserCircle2,
  X,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageUploader } from "@/components/admin/image-uploader";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogCloseButton,
} from "@/components/ui/dialog";
import {
  createStaff,
  deleteStaff,
  updateStaff,
  uploadStaffPhoto,
} from "@/app/r/[slug]/admin/(panel)/vertical-actions";

interface StaffRow {
  id: string;
  name: string;
  title: string | null;
  bio: string | null;
  photoUrl: string | null;
  specialties: string[];
  bookingUrl: string | null;
  instagram: string | null;
  yearsExperience: number | null;
  isActive: boolean;
}

interface Props {
  slug: string;
  clientType: string;
  staff: StaffRow[];
}

const TITLE_BY_TYPE: Record<string, { title: string; blurb: string; addLabel: string }> = {
  personal_service: {
    title: "Stylists & team",
    blurb: "Add each stylist with photo + specialties + their personal booking link. Clients pick who they want to book with.",
    addLabel: "Add stylist",
  },
  healthcare: {
    title: "Providers",
    blurb: "Add each provider with credentials, bio, and what they specialize in. Each gets a deep profile on the public site.",
    addLabel: "Add provider",
  },
  fitness: {
    title: "Coaches & instructors",
    blurb: "Add coaches with certifications + their specialties. Clients connect with whoever fits their goals.",
    addLabel: "Add coach",
  },
  professional_service: {
    title: "Attorneys & team",
    blurb: "Add each team member with their bio, credentials, and practice areas.",
    addLabel: "Add team member",
  },
};

export function TeamManager({ slug, clientType, staff }: Props) {
  const router = useRouter();
  const meta =
    TITLE_BY_TYPE[clientType] ?? {
      title: "Team",
      blurb: "Add your team — photos, titles, bios, and what makes each person worth knowing.",
      addLabel: "Add team member",
    };
  const [editing, setEditing] = React.useState<StaffRow | null>(null);
  const [adding, setAdding] = React.useState(false);

  async function onDelete(row: StaffRow) {
    if (!confirm(`Remove ${row.name}?`)) return;
    const res = await deleteStaff({ slug, id: row.id });
    if (res.ok) {
      toast.success(`${row.name} removed`);
      router.refresh();
    } else {
      toast.error("error" in res ? res.error : "Could not delete");
    }
  }

  return (
    <>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="font-display text-4xl text-surface-900">{meta.title}</h1>
          <p className="text-sm text-surface-500 mt-1 max-w-2xl">{meta.blurb}</p>
        </div>
        <Button onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" /> {meta.addLabel}
        </Button>
      </div>

      {staff.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-surface-300 bg-white/60 p-12 text-center">
          <div className="mx-auto h-12 w-12 grid place-items-center rounded-full bg-brand/10 text-brand">
            <UserCircle2 className="h-6 w-6" />
          </div>
          <div className="mt-4 font-display text-2xl text-surface-900">
            No one on the team yet
          </div>
          <p className="mt-1 text-sm text-surface-500 max-w-md mx-auto">
            Add a member — their photo + bio + a booking link goes a long way
            for conversion.
          </p>
          <Button className="mt-6" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> {meta.addLabel}
          </Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {staff.map((s) => (
            <div
              key={s.id}
              className="group rounded-2xl border border-surface-200 bg-white shadow-soft overflow-hidden hover:shadow-elevated transition"
            >
              <div className="relative aspect-square bg-surface-100">
                {s.photoUrl ? (
                  <Image
                    src={s.photoUrl}
                    alt={s.name}
                    fill
                    sizes="(max-width: 640px) 100vw, 320px"
                    className="object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-surface-400">
                    <UserCircle2 className="h-16 w-16" />
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="font-display text-lg text-surface-900 truncate">
                  {s.name}
                </div>
                {s.title && (
                  <div className="text-xs text-surface-500 truncate">{s.title}</div>
                )}
                {s.specialties.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {s.specialties.slice(0, 3).map((sp) => (
                      <span
                        key={sp}
                        className="inline-flex items-center rounded-full bg-brand/10 text-brand px-2 py-0.5 text-[10px] font-medium"
                      >
                        {sp}
                      </span>
                    ))}
                    {s.specialties.length > 3 && (
                      <span className="text-[10px] text-surface-500 self-center">
                        +{s.specialties.length - 3}
                      </span>
                    )}
                  </div>
                )}
                <div className="mt-3 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditing(s)}
                    className="flex-1 inline-flex items-center justify-center gap-1 h-9 rounded-full bg-surface-100 text-xs font-medium text-surface-800 hover:bg-surface-200 transition"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  {s.bookingUrl && (
                    <a
                      href={s.bookingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="h-9 w-9 grid place-items-center rounded-full text-surface-500 hover:bg-surface-100 transition"
                      title="Open booking link"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => onDelete(s)}
                    className="h-9 w-9 grid place-items-center rounded-full text-surface-400 hover:bg-red-50 hover:text-red-600 transition"
                    title="Remove"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <StaffDialog
        slug={slug}
        open={adding}
        onOpenChange={(o) => !o && setAdding(false)}
        onSaved={() => {
          setAdding(false);
          router.refresh();
        }}
      />
      <StaffDialog
        slug={slug}
        open={!!editing}
        existing={editing ?? undefined}
        onOpenChange={(o) => !o && setEditing(null)}
        onSaved={() => {
          setEditing(null);
          router.refresh();
        }}
      />
    </>
  );
}

function StaffDialog({
  slug,
  open,
  onOpenChange,
  existing,
  onSaved,
}: {
  slug: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  existing?: StaffRow;
  onSaved: () => void;
}) {
  const [name, setName] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [bio, setBio] = React.useState("");
  const [specialties, setSpecialties] = React.useState<string[]>([]);
  const [specInput, setSpecInput] = React.useState("");
  const [bookingUrl, setBookingUrl] = React.useState("");
  const [instagram, setInstagram] = React.useState("");
  const [years, setYears] = React.useState("");
  const [photoUrl, setPhotoUrl] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setName(existing?.name ?? "");
      setTitle(existing?.title ?? "");
      setBio(existing?.bio ?? "");
      setSpecialties(existing?.specialties ?? []);
      setSpecInput("");
      setBookingUrl(existing?.bookingUrl ?? "");
      setInstagram(existing?.instagram ?? "");
      setYears(existing?.yearsExperience?.toString() ?? "");
      setPhotoUrl(existing?.photoUrl ?? null);
    }
  }, [open, existing]);

  function addSpec() {
    const s = specInput.trim();
    if (!s) return;
    if (specialties.includes(s)) {
      setSpecInput("");
      return;
    }
    if (specialties.length >= 20) {
      toast.message("Max 20 specialties");
      return;
    }
    setSpecialties([...specialties, s]);
    setSpecInput("");
  }

  async function uploadFile(file: File): Promise<string> {
    const fd = new FormData();
    fd.append("slug", slug);
    fd.append("file", file);
    const res = await uploadStaffPhoto(fd);
    if (!res.ok || !res.imageUrl) {
      throw new Error(res.error ?? "Upload failed");
    }
    return res.imageUrl;
  }
  async function removeFile(): Promise<void> {
    setPhotoUrl(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        slug,
        name: name.trim(),
        title: title.trim() || null,
        bio: bio.trim() || null,
        specialties,
        bookingUrl: bookingUrl.trim() || null,
        instagram: instagram.trim() || null,
        yearsExperience: years ? parseInt(years, 10) : null,
        photoUrl,
      };
      const res = existing
        ? await updateStaff({ id: existing.id, ...payload })
        : await createStaff(payload);
      if (res.ok) {
        toast.success(existing ? "Updated" : "Added");
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
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit team member" : "Add team member"}</DialogTitle>
          <DialogDescription>
            Photo + a short bio + specialties + their booking link.
          </DialogDescription>
          <DialogCloseButton />
        </DialogHeader>

        <form onSubmit={onSubmit} className="px-6 pb-6 grid gap-4">
          <div className="grid gap-1.5">
            <Label>Photo</Label>
            <ImageUploader
              value={photoUrl}
              onUploaded={setPhotoUrl}
              onRemoved={removeFile}
              upload={uploadFile}
              remove={removeFile}
              alt={name || "Team member"}
              className="max-w-sm"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="st-name">Name *</Label>
              <Input
                id="st-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="st-title">Title</Label>
              <Input
                id="st-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Senior Stylist / DDS / Head Coach"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="st-bio">Bio</Label>
            <Textarea
              id="st-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              placeholder="A short, warm introduction — what they specialize in, how long they've been at it, what people love about them."
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Specialties</Label>
            <div className="flex items-center gap-2">
              <Input
                value={specInput}
                onChange={(e) => setSpecInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSpec();
                  }
                }}
                placeholder="balayage, curly cuts, men's grooming…"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addSpec}
                disabled={!specInput.trim()}
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </div>
            {specialties.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {specialties.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1 rounded-full bg-brand/10 text-brand px-2.5 py-1 text-xs"
                  >
                    {s}
                    <button
                      type="button"
                      onClick={() => setSpecialties(specialties.filter((x) => x !== s))}
                      className="hover:text-brand/70"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="st-book">Booking link</Label>
              <Input
                id="st-book"
                value={bookingUrl}
                onChange={(e) => setBookingUrl(e.target.value)}
                placeholder="booksy.com/... or vagaro.com/..."
              />
              <p className="text-[11px] text-surface-500">
                Per-staff link beats one generic one — clients pick their person.
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="st-years">Years experience</Label>
              <Input
                id="st-years"
                type="number"
                value={years}
                onChange={(e) => setYears(e.target.value)}
                min="0"
                max="100"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="st-ig">Instagram handle</Label>
            <Input
              id="st-ig"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="@theirhandle"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-surface-100">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {existing ? "Save changes" : "Add to team"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _used = cn;
