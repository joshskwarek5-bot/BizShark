"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Image as ImageIcon,
  Loader2,
  Trash2,
  Upload,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addGalleryImage,
  deleteGalleryImage,
  uploadStaffPhoto,
} from "@/app/r/[slug]/admin/(panel)/vertical-actions";

interface ImageRow {
  id: string;
  imageUrl: string;
  caption: string | null;
  tag: string | null;
}

interface Props {
  slug: string;
  clientType: string;
  images: ImageRow[];
}

const TAG_PRESETS: Record<string, string[]> = {
  personal_service: ["cuts", "color", "nails", "space", "team"],
  trade_service: ["before", "after", "in-progress", "team"],
  fitness: ["space", "members", "events", "equipment"],
  healthcare: ["office", "team", "before", "after"],
  professional_service: ["team", "office", "events"],
  retail: ["store", "products", "events"],
  restaurant: ["food", "space", "events", "team"],
  service_business: ["work", "team", "before", "after"],
};

export function GalleryManager({ slug, clientType, images }: Props) {
  const router = useRouter();
  const [uploading, setUploading] = React.useState(false);
  const [pendingTag, setPendingTag] = React.useState<string>("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const presets = TAG_PRESETS[clientType] ?? TAG_PRESETS.service_business;

  async function handleFiles(files: FileList | File[]) {
    setUploading(true);
    try {
      let successes = 0;
      for (const f of Array.from(files)) {
        if (!/^image\/(jpeg|png|webp|gif)$/.test(f.type)) {
          toast.error(`Skipping ${f.name} — needs to be jpg/png/webp/gif`);
          continue;
        }
        if (f.size > 5 * 1024 * 1024) {
          toast.error(`Skipping ${f.name} — over 5 MB`);
          continue;
        }
        try {
          // Reuse the staff photo uploader (same kind=items folder)
          const fd = new FormData();
          fd.append("slug", slug);
          fd.append("file", f);
          const up = await uploadStaffPhoto(fd);
          if (!up.ok || !up.imageUrl) {
            toast.error(`Upload failed for ${f.name}`);
            continue;
          }
          const add = await addGalleryImage({
            slug,
            imageUrl: up.imageUrl,
            tag: pendingTag || null,
            caption: null,
          });
          if (add.ok) successes++;
        } catch (e) {
          console.warn("[gallery upload]", e);
        }
      }
      if (successes > 0) {
        toast.success(`Added ${successes} photo${successes === 1 ? "" : "s"}`);
        router.refresh();
      }
    } finally {
      setUploading(false);
    }
  }

  async function onDelete(row: ImageRow) {
    if (!confirm("Delete this photo from the gallery?")) return;
    const res = await deleteGalleryImage({ slug, id: row.id });
    if (res.ok) {
      toast.success("Removed");
      router.refresh();
    } else {
      toast.error("error" in res ? res.error : "Delete failed");
    }
  }

  // Filter chips by tag
  const allTags = Array.from(
    new Set(images.map((i) => i.tag).filter((t): t is string => !!t))
  );
  const [filter, setFilter] = React.useState<string | null>(null);
  const filtered = filter ? images.filter((i) => i.tag === filter) : images;

  return (
    <>
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="font-display text-4xl text-surface-900">Gallery</h1>
          <p className="text-sm text-surface-500 mt-1 max-w-2xl">
            Real photos of your space, work, and team. Original photography
            converts way better than stock.
          </p>
        </div>
      </div>

      {/* Upload area */}
      <div
        className={cn(
          "rounded-3xl border-2 border-dashed p-6 mb-6 transition",
          uploading
            ? "border-brand bg-brand/5"
            : "border-surface-300 bg-surface-50 hover:border-surface-400"
        )}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
        }}
      >
        <div className="flex items-center gap-5 flex-wrap">
          <div className="h-12 w-12 grid place-items-center rounded-full bg-brand text-brand-fg">
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Upload className="h-5 w-5" />
            )}
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="font-medium text-surface-900">
              {uploading ? "Uploading…" : "Drop photos here, or click to choose"}
            </div>
            <p className="text-xs text-surface-500 mt-0.5">
              Up to 5 MB each — JPG / PNG / WEBP / GIF
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">Tag</Label>
            <select
              value={pendingTag}
              onChange={(e) => setPendingTag(e.target.value)}
              className="h-10 rounded-xl border border-surface-200 bg-white px-3 text-sm"
            >
              <option value="">No tag</option>
              {presets.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            <Plus className="h-4 w-4" /> Choose photos
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFiles(e.target.files);
            }
            e.target.value = "";
          }}
        />
      </div>

      {allTags.length > 0 && (
        <div className="mb-4 flex gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setFilter(null)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition",
              filter === null
                ? "bg-brand text-brand-fg"
                : "bg-surface-100 text-surface-700 hover:bg-surface-200"
            )}
          >
            All ({images.length})
          </button>
          {allTags.map((t) => {
            const count = images.filter((i) => i.tag === t).length;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setFilter(t)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition capitalize",
                  filter === t
                    ? "bg-brand text-brand-fg"
                    : "bg-surface-100 text-surface-700 hover:bg-surface-200"
                )}
              >
                {t} ({count})
              </button>
            );
          })}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-surface-300 bg-white/60 p-12 text-center">
          <div className="mx-auto h-12 w-12 grid place-items-center rounded-full bg-surface-100 text-surface-500">
            <ImageIcon className="h-6 w-6" />
          </div>
          <div className="mt-4 font-display text-2xl text-surface-900">
            {images.length === 0 ? "Gallery is empty" : "Nothing in this tag"}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((img) => (
            <div
              key={img.id}
              className="group relative aspect-square rounded-2xl overflow-hidden bg-surface-100 ring-1 ring-surface-200"
            >
              <Image
                src={img.imageUrl}
                alt={img.caption ?? "Gallery photo"}
                fill
                sizes="(max-width: 640px) 50vw, 280px"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-surface-900/30 opacity-0 group-hover:opacity-100 transition flex items-end justify-between p-2">
                {img.tag && (
                  <span className="inline-block rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-medium text-surface-800 capitalize">
                    {img.tag}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onDelete(img)}
                  className="ml-auto h-7 w-7 grid place-items-center rounded-full bg-white/95 text-red-600 hover:bg-red-500 hover:text-white transition"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
