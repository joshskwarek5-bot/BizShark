"use client";

import * as React from "react";
import { toast } from "sonner";
import { Sparkles, Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type ClientType, type ServiceItem } from "@/lib/client-type";
import { generateCopyAction } from "./ai-actions";

export interface AIGeneratedCopy {
  tagline: string;
  heroHeadline: string;
  heroSubhead: string;
  aboutCopy: string;
  primaryColor: string;
  accentColor: string;
  services: ServiceItem[];
}

interface AIAssistProps {
  type: ClientType;
  businessName: string;
  city: string;
  available: boolean;
  onApply: (copy: AIGeneratedCopy) => void;
}

export function AIAssist({ type, businessName, city, available, onApply }: AIAssistProps) {
  const [brief, setBrief] = React.useState("");
  const [generating, setGenerating] = React.useState(false);

  async function run() {
    if (!businessName.trim()) {
      toast.error("Add a business name first");
      return;
    }
    if (brief.trim().length < 8) {
      toast.error("Give me a sentence or two to work with");
      return;
    }
    setGenerating(true);
    try {
      const res = await generateCopyAction({
        brief: brief.trim(),
        type,
        businessName: businessName.trim(),
        city: city.trim() || undefined,
      });
      if (!res.ok || !res.result) {
        toast.error(res.error ?? "Generation failed");
        return;
      }
      const r = res.result;
      const services: ServiceItem[] = (r.services ?? []).map((s, i) => ({
        id: `gen-${Date.now()}-${i}`,
        name: s.name,
        description: s.description,
        priceCents: s.priceCents,
        duration: s.duration,
      }));
      onApply({
        tagline: r.tagline,
        heroHeadline: r.heroHeadline,
        heroSubhead: r.heroSubhead,
        aboutCopy: r.aboutCopy,
        primaryColor: r.primaryColor,
        accentColor: r.accentColor,
        services,
      });
      toast.success("Copy generated — review and edit below", {
        icon: <Sparkles className="h-4 w-4" />,
      });
    } catch (e) {
      console.error(e);
      toast.error("Network error");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <section className="rounded-3xl border-2 border-brand/30 bg-gradient-to-br from-brand/5 via-white to-accent/5 shadow-soft p-6 md:p-8 space-y-5">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 grid place-items-center rounded-full bg-brand text-brand-fg shadow-soft">
          <Wand2 className="h-5 w-5" />
        </div>
        <div>
          <div className="font-display text-xl text-surface-900">AI assist</div>
          <p className="text-sm text-surface-600 mt-0.5">
            Describe the business in a sentence or two. Claude drafts the tagline, about
            section, services, and a color palette — you edit anything below before saving.
          </p>
        </div>
      </div>

      {!available && (
        <div className="rounded-2xl bg-amber-50 ring-1 ring-amber-200 p-4 text-sm text-amber-900">
          AI generation is unavailable. Add{" "}
          <code className="font-mono text-xs bg-amber-100 px-1.5 py-0.5 rounded">
            ANTHROPIC_API_KEY
          </code>{" "}
          to your <code className="font-mono text-xs">.env</code> and restart the dev server.
        </div>
      )}

      <div className="grid gap-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor="brief">Brief</Label>
          <span
            className={`text-[11px] tabular-nums ${
              brief.length > 20000
                ? "text-red-600 font-medium"
                : brief.length > 18000
                  ? "text-amber-600"
                  : "text-surface-400"
            }`}
          >
            {brief.length.toLocaleString()} / 20,000
          </span>
        </div>
        <Textarea
          id="brief"
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={6}
          disabled={!available}
          placeholder="e.g. Family-owned Italian restaurant in Boulder, been open 12 years, known for handmade pasta and a great wine list. Paste the menu too if you have it — that helps a lot."
          className="text-sm"
        />
        <p className="text-xs text-surface-500">
          Mention what the business does, location, vibe, anything distinctive. You can
          paste a full menu — the more specific, the better.
        </p>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={run}
          disabled={generating || !available || brief.trim().length < 8}
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Generating…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" /> Generate with AI
            </>
          )}
        </Button>
      </div>
    </section>
  );
}
