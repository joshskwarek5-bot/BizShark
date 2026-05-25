"use client";

import * as React from "react";
import { toast } from "sonner";
import { DollarSign, Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { cn, formatMoney } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogCloseButton,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { verifyRevenuePin } from "@/app/r/[slug]/admin/(panel)/actions";

interface RevenueStatProps {
  slug: string;
  revenueCents: number;
  hasPin: boolean;
}

const STORAGE_PREFIX = "rp_rev_";

export function RevenueStat({ slug, revenueCents, hasPin }: RevenueStatProps) {
  const [mounted, setMounted] = React.useState(false);
  const [revealed, setRevealed] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [pin, setPin] = React.useState("");
  const [verifying, setVerifying] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setMounted(true);
    if (!hasPin) {
      setRevealed(true);
      return;
    }
    try {
      const v = sessionStorage.getItem(STORAGE_PREFIX + slug);
      setRevealed(v === "1");
    } catch {}
  }, [slug, hasPin]);

  function hide() {
    setRevealed(false);
    try {
      sessionStorage.removeItem(STORAGE_PREFIX + slug);
    } catch {}
  }

  function unlockPrompt() {
    setPin("");
    setError(null);
    setOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (verifying) return;
    if (!/^\d{4}$/.test(pin)) {
      setError("Enter a 4-digit PIN");
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      const res = await verifyRevenuePin({ slug, pin });
      if (res.ok && res.valid) {
        setRevealed(true);
        try {
          sessionStorage.setItem(STORAGE_PREFIX + slug, "1");
        } catch {}
        setOpen(false);
        toast.success("Revenue revealed for this session");
      } else {
        setError("Wrong PIN. Try again.");
      }
    } catch {
      setError("Could not verify. Try again.");
    } finally {
      setVerifying(false);
    }
  }

  const showValue = mounted && revealed;

  return (
    <>
      <div className="rounded-2xl border border-surface-200 bg-white p-5 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-surface-500 uppercase tracking-wider">
            Revenue today
          </div>
          <div className="h-9 w-9 grid place-items-center rounded-full bg-brand/10 text-brand">
            <DollarSign className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3 flex items-baseline justify-between gap-3">
          <div
            className={cn(
              "font-display text-3xl text-surface-900 tabular-nums transition-all",
              !showValue && "blur-md select-none"
            )}
            aria-hidden={!showValue}
          >
            {showValue ? formatMoney(revenueCents) : "$•••.••"}
          </div>
          {hasPin && mounted && (
            <button
              type="button"
              onClick={revealed ? hide : unlockPrompt}
              className="inline-flex items-center gap-1 text-xs font-medium text-surface-600 hover:text-brand transition"
              aria-label={revealed ? "Hide revenue" : "Show revenue"}
            >
              {revealed ? (
                <>
                  <EyeOff className="h-3.5 w-3.5" /> Hide
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5" /> Show
                </>
              )}
            </button>
          )}
        </div>
        {hasPin && !showValue && mounted && (
          <button
            type="button"
            onClick={unlockPrompt}
            className="absolute inset-0 bg-transparent"
            aria-label="Tap to enter PIN and reveal revenue"
          />
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 grid place-items-center rounded-full bg-brand/10 text-brand">
                <Lock className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle>Enter PIN</DialogTitle>
                <DialogDescription>Reveal revenue for this session.</DialogDescription>
              </div>
            </div>
            <DialogCloseButton />
          </DialogHeader>
          <form onSubmit={submit} className="px-6 pb-6 grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="pin-input">4-digit PIN</Label>
              <Input
                id="pin-input"
                value={pin}
                onChange={(e) => {
                  setError(null);
                  setPin(e.target.value.replace(/\D/g, "").slice(0, 4));
                }}
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                placeholder="• • • •"
                className="font-mono tracking-[0.5em] text-center text-xl h-14"
              />
              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={verifying || pin.length !== 4}>
                {verifying && <Loader2 className="h-4 w-4 animate-spin" />}
                Reveal
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
