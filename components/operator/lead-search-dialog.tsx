"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Search, Sparkles, AlertCircle } from "lucide-react";
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

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultCity?: string | null;
  defaultState?: string | null;
  hasApiKey: boolean;
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
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
        onlyNoWebsite,
      });
      if (res.ok) {
        const desc = onlyNoWebsite
          ? `Saved ${res.savedCount} new lead${res.savedCount === 1 ? "" : "s"} (no website). ` +
            `${res.totalReturned} businesses returned, ${res.skippedCount} already in your list.`
          : `Saved ${res.savedCount} new lead${res.savedCount === 1 ? "" : "s"}. ${res.skippedCount} already in your list.`;
        toast.success("Search complete", { description: desc, duration: 6000 });
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "Search failed");
      }
    } finally {
      setSearching(false);
    }
  }

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
          <form onSubmit={onSubmit} className="px-6 pb-6 grid gap-5">
            <div className="grid gap-1.5">
              <Label htmlFor="lead-city">City / area</Label>
              <Input
                id="lead-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Boulder, CO"
                required
                autoFocus
              />
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
              <p className="text-xs text-surface-500">
                e.g. restaurant, cafe, HVAC, salon, plumber. Leave blank for any.
              </p>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-surface-50 px-4 py-3">
              <div>
                <div className="text-sm font-medium text-surface-900">
                  Only show businesses without a website
                </div>
                <div className="text-xs text-surface-500 mt-0.5">
                  These are your highest-value prospects.
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
              <Button type="submit" disabled={searching}>
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
