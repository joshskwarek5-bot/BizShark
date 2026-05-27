"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Search, Sparkles, AlertCircle, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogCloseButton,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { searchLeadsAction } from "@/app/app/leads/actions";
import type { LeadCapacity } from "@/lib/subscriptions";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultCity?: string | null;
  defaultState?: string | null;
  hasApiKey: boolean;
  capacity: LeadCapacity;
  tierName: string;
}

const COMMON_TYPES = [
  "restaurant",
  "cafe",
  "bar",
  "salon",
  "barbershop",
  "spa",
  "gym",
  "HVAC",
  "plumber",
  "electrician",
  "auto repair",
  "landscaping",
  "dentist",
  "law firm",
  "accountant",
];

export function LeadSearchDialog({
  open,
  onOpenChange,
  defaultCity,
  defaultState,
  hasApiKey,
  capacity,
  tierName,
}: Props) {
  const router = useRouter();
  const [city, setCity] = React.useState("");
  const [businessType, setBusinessType] = React.useState("restaurant");
  const [onlyNoWebsite, setOnlyNoWebsite] = React.useState(true);
  const [searching, setSearching] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      const initialCity =
        defaultCity && defaultState
          ? `${defaultCity}, ${defaultState}`
          : defaultCity ?? "";
      setCity(initialCity);
    }
  }, [open, defaultCity, defaultState]);

  async function runSearch(loosen?: { dropWebsiteFilter?: boolean }) {
    if (searching) return;
    if (city.trim().length < 2) {
      toast.error("Enter a city or area");
      return;
    }
    setSearching(true);
    try {
      const res = await searchLeadsAction({
        query: city.trim(),
        businessType: businessType.trim() || undefined,
        onlyNoWebsite: loosen?.dropWebsiteFilter ? false : onlyNoWebsite,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Search failed");
        return;
      }
      const d = res.diagnostic!;
      const cap = res.capacity!;

      // Saved 0 leads — explain why + offer to loosen
      if (d.saved === 0) {
        if (d.skippedDueToCap > 0) {
          toast.error(
            `Found ${d.skippedDueToCap} match${d.skippedDueToCap === 1 ? "" : "es"} but you're at your cap. Delete some leads or upgrade.`,
            { duration: 7000 }
          );
        } else if (d.returned === 0) {
          toast.error(
            `Google returned 0 results for "${d.queryUsed}"${d.fallbackTried ? " (tried without type filter too)" : ""}. Try a different city or business type.`,
            { duration: 7000 }
          );
        } else if (d.haveWebsite === d.returned && onlyNoWebsite) {
          toast.error(
            `All ${d.returned} places have websites — you filtered them out. Click below to search again WITHOUT the no-website filter.`,
            {
              duration: 10000,
              action: {
                label: "Search again without filter",
                onClick: () => void runSearch({ dropWebsiteFilter: true }),
              },
            }
          );
        } else if (d.duplicates > 0) {
          toast.message(
            `All ${d.duplicates} match${d.duplicates === 1 ? "" : "es"} are already in your list.`
          );
        } else {
          toast.error("No new leads. Try a different query.");
        }
        return;
      }

      // Success — describe what landed
      const parts: string[] = [
        `Saved ${d.saved} new lead${d.saved === 1 ? "" : "s"}.`,
      ];
      if (d.duplicates > 0) parts.push(`${d.duplicates} already in your list.`);
      if (d.haveWebsite > 0 && onlyNoWebsite)
        parts.push(`${d.haveWebsite} filtered (had websites).`);
      if (d.skippedDueToCap > 0)
        parts.push(`${d.skippedDueToCap} couldn't be saved — you're at cap.`);

      toast.success(parts[0], {
        description: parts.slice(1).join(" ") || `${cap.remaining} of ${cap.cap} slots left.`,
        duration: 7000,
        action:
          d.skippedDueToCap > 0
            ? { label: "Upgrade", onClick: () => router.push("/app/billing") }
            : undefined,
      });
      onOpenChange(false);
      router.refresh();
    } finally {
      setSearching(false);
    }
  }

  const atCap = capacity.state === "full";
  const lowSlots = capacity.remaining > 0 && capacity.remaining < 5;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 grid place-items-center rounded-full bg-brand text-brand-fg">
              <Search className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle>Find leads</DialogTitle>
              <DialogDescription>
                Search local businesses via Google Places.
              </DialogDescription>
            </div>
          </div>
          <DialogCloseButton />
        </DialogHeader>

        {!hasApiKey ? (
          <div className="px-6 pb-6 space-y-4">
            <div className="rounded-2xl bg-amber-50 ring-1 ring-amber-200 p-4 text-sm text-amber-900 flex items-start gap-3">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-700" />
              <div>
                <div className="font-medium">Google Places API key needed</div>
                <p className="mt-1">
                  Add your key in <strong>Settings</strong> before running a search.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
              <Button asChild>
                <a href="/app/settings">Open Settings</a>
              </Button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void runSearch();
            }}
            className="px-6 pb-6 grid gap-5"
          >
            {/* Capacity hint */}
            <div
              className={
                atCap
                  ? "rounded-2xl bg-red-50 ring-1 ring-red-200 p-3 text-xs text-red-800 flex items-start gap-2"
                  : lowSlots
                    ? "rounded-2xl bg-amber-50 ring-1 ring-amber-200 p-3 text-xs text-amber-800 flex items-start gap-2"
                    : "rounded-2xl bg-surface-50 ring-1 ring-surface-200 p-3 text-xs text-surface-600 flex items-start gap-2"
              }
            >
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <div>
                {atCap
                  ? `You're at ${capacity.used}/${capacity.cap} leads. Delete some or upgrade to save new ones.`
                  : `${capacity.remaining} of ${capacity.cap} slots open on the ${tierName} plan. We'll save up to that many.`}
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="lead-city">City / area</Label>
              <Input
                id="lead-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Golden, CO"
                required
                autoFocus
              />
              <p className="text-[11px] text-surface-500">
                A city, neighborhood, or ZIP works. Don&apos;t add the business type
                here — use the field below.
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="lead-type">Business type</Label>
              <Input
                id="lead-type"
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                placeholder="restaurant"
                list="lead-types"
              />
              <datalist id="lead-types">
                {COMMON_TYPES.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
              <p className="text-[11px] text-surface-500">
                e.g. restaurant, cafe, HVAC, salon, plumber. Recognized categories
                use a strict Google primary-type filter. Leave blank for any.
              </p>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-surface-50 px-4 py-3">
              <div>
                <div className="text-sm font-medium text-surface-900">
                  Only show businesses without a website
                </div>
                <div className="text-xs text-surface-500 mt-0.5">
                  Includes places whose only URL is Facebook/Yelp/etc.
                </div>
              </div>
              <Switch
                checked={onlyNoWebsite}
                onCheckedChange={setOnlyNoWebsite}
                aria-label="Only no-website businesses"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={searching || atCap}>
                {searching ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Searching…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> Find leads
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
