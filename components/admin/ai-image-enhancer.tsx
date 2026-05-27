"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Wand2,
  Loader2,
  Upload,
  X,
  Sparkles,
  Image as ImageIcon,
  ExternalLink,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogCloseButton,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { enhanceImageAction } from "@/app/r/[slug]/admin/(panel)/actions";

type Kind = "hero" | "logo" | "item";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  slug: string;
  kind: Kind;
  /** Item id when kind=item. */
  itemId?: string;
  /** Pre-fill subject (e.g. menu item name). */
  defaultSubject?: string;
  /** Show the existing image alongside for context. */
  currentImageUrl?: string | null;
  /** Called after the new image is saved server-side. */
  onSaved?: (newUrl: string) => void;
}

interface RefSlot {
  file: File;
  previewUrl: string;
}

const KIND_META: Record<
  Kind,
  { title: string; subjectLabel: string; subjectPlaceholder: string; hint: string }
> = {
  hero: {
    title: "Generate a hero banner",
    subjectLabel: "Restaurant name",
    subjectPlaceholder: "Mama Bears Cafe",
    hint: "Drop 1–3 photos of the actual space (Google Images, walkthrough pics). OpenAI uses them as visual reference for the polished hero.",
  },
  logo: {
    title: "Generate a logo mark",
    subjectLabel: "Brand name",
    subjectPlaceholder: "Mama Bears",
    hint: "Drop in any reference (an existing rough logo, an inspiration). The result is a clean square mark.",
  },
  item: {
    title: "Generate a menu item photo",
    subjectLabel: "Dish",
    subjectPlaceholder: "Denver Skillet — eggs, peppers, ham, cheese",
    hint: "Drop in a phone pic of the dish (or a stock photo). OpenAI cleans it up into food-photography quality.",
  },
};

export function AIImageEnhancer({
  open,
  onOpenChange,
  slug,
  kind,
  itemId,
  defaultSubject,
  currentImageUrl,
  onSaved,
}: Props) {
  const router = useRouter();
  const meta = KIND_META[kind];

  const [subject, setSubject] = React.useState(defaultSubject ?? "");
  const [extra, setExtra] = React.useState("");
  const [refs, setRefs] = React.useState<RefSlot[]>([]);
  const [generating, setGenerating] = React.useState(false);
  const [generated, setGenerated] = React.useState<string | null>(null);
  const [elapsed, setElapsed] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) {
      setSubject(defaultSubject ?? "");
      setExtra("");
      refs.forEach((r) => URL.revokeObjectURL(r.previewUrl));
      setRefs([]);
      setGenerating(false);
      setGenerated(null);
      setElapsed(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  React.useEffect(() => {
    if (!generating) {
      setElapsed(0);
      return;
    }
    const start = Date.now();
    const t = setInterval(
      () => setElapsed(Math.floor((Date.now() - start) / 1000)),
      500
    );
    return () => clearInterval(t);
  }, [generating]);

  function genStatus(s: number): string {
    if (s < 4) return "Sending references to OpenAI…";
    if (s < 12) return "Composing your image…";
    if (s < 25) return "Polishing details…";
    return "Almost done — gpt-image-1 takes a moment…";
  }

  function addFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    const remaining = 3 - refs.length;
    if (remaining <= 0) {
      toast.error("Max 3 reference photos");
      return;
    }
    const accepted: RefSlot[] = [];
    for (const f of arr.slice(0, remaining)) {
      if (!/^image\/(jpeg|png|webp|gif)$/.test(f.type)) {
        toast.error(`Skipping ${f.name} — needs to be jpg/png/webp/gif`);
        continue;
      }
      if (f.size > 5 * 1024 * 1024) {
        toast.error(`Skipping ${f.name} — over 5 MB`);
        continue;
      }
      accepted.push({ file: f, previewUrl: URL.createObjectURL(f) });
    }
    if (accepted.length === 0) return;
    setRefs((rs) => [...rs, ...accepted]);
  }

  function removeRef(idx: number) {
    setRefs((rs) => {
      const removed = rs[idx];
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return rs.filter((_, i) => i !== idx);
    });
  }

  async function onGenerate() {
    if (generating) return;
    setGenerating(true);
    setGenerated(null);
    try {
      const fd = new FormData();
      fd.append("slug", slug);
      fd.append("kind", kind);
      if (subject.trim()) fd.append("subject", subject.trim());
      if (extra.trim()) fd.append("extra", extra.trim());
      if (itemId) fd.append("itemId", itemId);
      refs.forEach((r, i) => fd.append(`ref${i + 1}`, r.file, r.file.name));
      const res = await enhanceImageAction(fd);
      if (res.ok) {
        setGenerated(res.url);
        onSaved?.(res.url);
        toast.success("Image saved", {
          description: "Generated + uploaded. You can regenerate or close.",
        });
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 grid place-items-center rounded-full bg-brand text-brand-fg">
              <Wand2 className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle>{meta.title}</DialogTitle>
              <DialogDescription>{meta.hint}</DialogDescription>
            </div>
          </div>
          <DialogCloseButton />
        </DialogHeader>

        <div className="px-6 pb-6 grid gap-5">
          {/* Reference uploads */}
          <div className="grid gap-2">
            <Label>Reference photos (optional, up to 3)</Label>
            <div className="grid grid-cols-3 gap-2">
              {refs.map((r, i) => (
                <div
                  key={i}
                  className="relative aspect-square rounded-xl overflow-hidden ring-1 ring-surface-200 group"
                >
                  <Image
                    src={r.previewUrl}
                    alt={`Reference ${i + 1}`}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                  <button
                    type="button"
                    onClick={() => removeRef(i)}
                    className="absolute top-1 right-1 h-6 w-6 grid place-items-center rounded-full bg-surface-900/70 text-white opacity-0 group-hover:opacity-100 transition"
                    aria-label="Remove"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {refs.length < 3 && (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files.length > 0)
                      addFiles(e.dataTransfer.files);
                  }}
                  className="aspect-square rounded-xl border-2 border-dashed border-surface-300 bg-surface-50 grid place-items-center hover:border-brand hover:bg-brand/5 transition"
                >
                  <div className="text-center text-xs text-surface-500 px-2">
                    <Upload className="h-4 w-4 mx-auto mb-1" />
                    Drop photo
                  </div>
                </button>
              )}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0)
                  addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <p className="text-[11px] text-surface-500">
              No photos? You can generate from text alone — but references give
              MUCH better results.
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="ai-subject">{meta.subjectLabel}</Label>
            <Input
              id="ai-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={meta.subjectPlaceholder}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="ai-extra">Extra direction (optional)</Label>
            <Textarea
              id="ai-extra"
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              rows={2}
              placeholder={
                kind === "hero"
                  ? "e.g. warm sunset light, cozy interior, exposed brick"
                  : kind === "item"
                    ? "e.g. on a wooden board, with a side of green chili"
                    : "e.g. earthy palette, hand-drawn feel"
              }
              className="text-sm"
            />
          </div>

          {generating && (
            <div className="rounded-2xl bg-sky-50 ring-1 ring-sky-200 p-4 flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-sky-700 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-sky-900">
                  {genStatus(elapsed)}
                </div>
                <div className="text-xs text-sky-700 mt-0.5 tabular-nums">
                  {elapsed}s elapsed · usually 10–30s
                </div>
              </div>
            </div>
          )}

          {/* Result + comparison */}
          {(currentImageUrl || generated) && (
            <div className="grid grid-cols-2 gap-3">
              {currentImageUrl && (
                <ImagePreviewCard label="Current" url={currentImageUrl} />
              )}
              {generated && (
                <ImagePreviewCard
                  label="AI generated"
                  url={generated}
                  badge="New"
                />
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-surface-100">
            <a
              href="https://platform.openai.com/usage"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-surface-500 hover:text-brand inline-flex items-center gap-1"
            >
              OpenAI usage
              <ExternalLink className="h-3 w-3" />
            </a>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                {generated ? "Done" : "Cancel"}
              </Button>
              <Button onClick={onGenerate} disabled={generating}>
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Generating…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />{" "}
                    {generated ? "Generate again" : "Generate"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ImagePreviewCard({
  label,
  url,
  badge,
}: {
  label: string;
  url: string;
  badge?: string;
}) {
  return (
    <div className="relative">
      <div className="aspect-square rounded-xl overflow-hidden ring-1 ring-surface-200 bg-surface-100 relative">
        <Image
          src={url}
          alt={label}
          fill
          className="object-cover"
          unoptimized={url.startsWith("blob:")}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-1">
        <span className="text-xs font-medium text-surface-700 flex items-center gap-1">
          <ImageIcon className="h-3 w-3 text-surface-400" />
          {label}
        </span>
        {badge && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200 rounded-full px-2 py-0.5">
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Compact button used inline on existing image-uploaders.
 */
export function EnhanceButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className="bg-gradient-to-r from-brand/10 to-transparent"
    >
      <Wand2 className="h-3.5 w-3.5" /> Enhance with AI
    </Button>
  );
}
