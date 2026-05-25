"use client";

import * as React from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Upload, Trash2, RotateCw, Loader2, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageUploaderProps {
  /** Current image URL (null if no image yet). */
  value: string | null;
  /** Called after a successful upload with the new URL. */
  onUploaded: (url: string) => void;
  /** Called after a successful remove. */
  onRemoved: () => void;
  /**
   * Called to perform the actual upload. Receives the File. Should call any
   * server action, store the result, and return the new URL (or throw).
   */
  upload: (file: File) => Promise<string>;
  /** Called to remove the existing image. */
  remove: () => Promise<void>;
  /** Optional alt text for accessibility. */
  alt?: string;
  className?: string;
}

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function ImageUploader({
  value,
  onUploaded,
  onRemoved,
  upload,
  remove,
  alt = "Uploaded image",
  className,
}: ImageUploaderProps) {
  const [uploading, setUploading] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);
  const [dragOver, setDragOver] = React.useState(false);
  // Local preview so the new image shows instantly while the upload is in-flight
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const displayUrl = previewUrl ?? value;

  async function handleFile(file: File) {
    if (!ALLOWED.includes(file.type)) {
      toast.error("Use a JPG, PNG, WEBP, or GIF");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(`Too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Max is 5 MB.`);
      return;
    }
    // Instant preview
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);
    setUploading(true);
    try {
      const url = await upload(file);
      onUploaded(url);
      toast.success("Image uploaded");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      toast.error(msg);
      setPreviewUrl(null); // revert to previous
    } finally {
      URL.revokeObjectURL(localUrl);
      setUploading(false);
    }
  }

  async function handleRemove() {
    if (removing) return;
    if (!confirm("Remove this image?")) return;
    setRemoving(true);
    try {
      await remove();
      setPreviewUrl(null);
      onRemoved();
      toast.success("Image removed");
    } catch {
      toast.error("Could not remove");
    } finally {
      setRemoving(false);
    }
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = ""; // allow re-uploading the same filename
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div className={cn("space-y-3", className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={onChange}
      />

      {displayUrl ? (
        <div className="group relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-surface-200 bg-surface-100">
          <Image
            src={displayUrl}
            alt={alt}
            fill
            sizes="(max-width: 768px) 100vw, 480px"
            className={cn(
              "object-cover transition",
              uploading && "opacity-60 scale-[1.02]"
            )}
            unoptimized={displayUrl.startsWith("blob:")}
          />
          {uploading && (
            <div className="absolute inset-0 grid place-items-center bg-surface-900/30">
              <div className="rounded-full bg-white px-4 py-2 shadow-soft inline-flex items-center gap-2 text-sm font-medium text-surface-800">
                <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
              </div>
            </div>
          )}
          <div className="absolute right-3 top-3 flex gap-2 opacity-0 group-hover:opacity-100 transition">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading || removing}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/95 backdrop-blur px-3 text-xs font-medium text-surface-800 shadow-soft hover:bg-white"
            >
              <RotateCw className="h-3.5 w-3.5" /> Replace
            </button>
            <button
              type="button"
              onClick={handleRemove}
              disabled={uploading || removing}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/95 backdrop-blur px-3 text-xs font-medium text-red-700 shadow-soft hover:bg-red-50"
            >
              {removing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          disabled={uploading}
          className={cn(
            "w-full aspect-[4/3] rounded-2xl border-2 border-dashed grid place-items-center transition",
            "text-center px-4",
            dragOver
              ? "border-brand bg-brand/5"
              : "border-surface-300 bg-surface-50 hover:border-surface-400 hover:bg-surface-100",
            uploading && "opacity-60"
          )}
        >
          <div className="flex flex-col items-center gap-2">
            <div className="h-12 w-12 grid place-items-center rounded-full bg-white shadow-crisp text-surface-500">
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Upload className="h-5 w-5" />
              )}
            </div>
            <div className="text-sm font-medium text-surface-800">
              {uploading ? "Uploading…" : "Click to upload or drag a photo here"}
            </div>
            <div className="text-xs text-surface-500 flex items-center gap-1.5">
              <ImageIcon className="h-3 w-3" /> JPG, PNG, WEBP — up to 5 MB
            </div>
          </div>
        </button>
      )}
    </div>
  );
}
