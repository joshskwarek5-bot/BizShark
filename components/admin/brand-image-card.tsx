"use client";

import * as React from "react";
import { toast } from "sonner";
import { Image as ImageIcon } from "lucide-react";
import { ImageUploader } from "@/components/admin/image-uploader";
import {
  AIImageEnhancer,
  EnhanceButton,
} from "@/components/admin/ai-image-enhancer";
import {
  removeRestaurantImage,
  uploadRestaurantImage,
} from "@/app/r/[slug]/admin/(panel)/actions";

interface Props {
  slug: string;
  kind: "hero" | "logo";
  initialUrl: string | null;
  restaurantName: string;
  hasOpenAI: boolean;
}

const COPY = {
  hero: {
    title: "Hero banner",
    blurb:
      "The big image at the top of your public site. Wide, atmospheric, no on-image text.",
  },
  logo: {
    title: "Logo",
    blurb: "Square brand mark used in the nav + browser tab.",
  },
};

export function BrandImageCard({
  slug,
  kind,
  initialUrl,
  restaurantName,
  hasOpenAI,
}: Props) {
  const [url, setUrl] = React.useState<string | null>(initialUrl);
  const [enhancerOpen, setEnhancerOpen] = React.useState(false);
  const meta = COPY[kind];

  async function uploadFile(file: File): Promise<string> {
    const fd = new FormData();
    fd.append("slug", slug);
    fd.append("kind", kind);
    fd.append("file", file);
    const res = await uploadRestaurantImage(fd);
    if (!res.ok || !res.imageUrl) {
      throw new Error(res.error ?? "Upload failed");
    }
    return res.imageUrl;
  }

  async function removeFile(): Promise<void> {
    const res = await removeRestaurantImage({ slug, kind });
    if (!res.ok) throw new Error("Remove failed");
  }

  return (
    <section className="rounded-3xl border border-surface-200 bg-white shadow-soft p-6 md:p-8">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
        <div className="flex items-center gap-2 text-sm font-medium text-surface-500">
          <ImageIcon className="h-4 w-4 text-brand" />
          <span className="uppercase tracking-wider text-xs">{meta.title}</span>
        </div>
        {hasOpenAI && (
          <EnhanceButton onClick={() => setEnhancerOpen(true)} />
        )}
      </div>
      <p className="text-sm text-surface-600 mb-4">{meta.blurb}</p>
      <ImageUploader
        value={url}
        onUploaded={(u) => setUrl(u)}
        onRemoved={() => setUrl(null)}
        upload={uploadFile}
        remove={removeFile}
        alt={`${restaurantName} ${kind}`}
      />
      {!hasOpenAI && (
        <p className="mt-3 text-xs text-surface-500">
          Tip: add an OpenAI API key in operator Settings to generate this image
          from reference photos.
        </p>
      )}
      <AIImageEnhancer
        open={enhancerOpen}
        onOpenChange={setEnhancerOpen}
        slug={slug}
        kind={kind}
        defaultSubject={restaurantName}
        currentImageUrl={url}
        onSaved={(u) => setUrl(u)}
      />
    </section>
  );
}
