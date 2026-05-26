"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Rocket,
  Search,
  Hammer,
  CreditCard,
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  Key,
  Eye,
  EyeOff,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateGooglePlacesKey } from "@/app/app/settings/actions";
import { completeOnboarding } from "@/app/app/welcome/actions";

interface Props {
  operatorName: string;
  businessName: string | null;
  areaCity: string | null;
  areaState: string | null;
  hasGooglePlacesKey: boolean;
  trialDaysLeft: number | null;
}

type StepId = "welcome" | "api-key" | "ready";
const STEP_ORDER: StepId[] = ["welcome", "api-key", "ready"];

export function OnboardingWizard({
  operatorName,
  businessName,
  areaCity,
  areaState,
  hasGooglePlacesKey,
  trialDaysLeft,
}: Props) {
  const router = useRouter();
  const [step, setStep] = React.useState<StepId>("welcome");
  const [apiKey, setApiKey] = React.useState("");
  const [showKey, setShowKey] = React.useState(false);
  const [savingKey, setSavingKey] = React.useState(false);
  const [savedKey, setSavedKey] = React.useState(hasGooglePlacesKey);
  const [completing, setCompleting] = React.useState(false);

  const stepIndex = STEP_ORDER.indexOf(step);
  const firstName = operatorName.split(" ")[0] ?? operatorName;

  function goNext() {
    const next = STEP_ORDER[stepIndex + 1];
    if (next) setStep(next);
  }
  function goBack() {
    const prev = STEP_ORDER[stepIndex - 1];
    if (prev) setStep(prev);
  }

  async function saveKey() {
    if (!apiKey.trim()) return;
    setSavingKey(true);
    try {
      const res = await updateGooglePlacesKey({ apiKey });
      if (res.ok) {
        toast.success("API key saved");
        setSavedKey(true);
        setApiKey("");
        router.refresh();
      } else {
        toast.error("Could not save");
      }
    } finally {
      setSavingKey(false);
    }
  }

  async function onComplete() {
    setCompleting(true);
    try {
      await completeOnboarding();
      // completeOnboarding redirects server-side
    } catch (e) {
      console.error(e);
      setCompleting(false);
      toast.error("Could not complete — try again");
    }
  }

  return (
    <div className="min-h-screen bg-surface-50 grid place-items-center px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Progress strip */}
        <div className="mb-8 flex items-center justify-center gap-2">
          {STEP_ORDER.map((s, i) => {
            const done = i < stepIndex;
            const active = i === stepIndex;
            return (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={cn(
                    "h-8 w-8 grid place-items-center rounded-full text-xs font-semibold transition",
                    done
                      ? "bg-brand text-brand-fg"
                      : active
                        ? "bg-surface-900 text-white"
                        : "bg-surface-200 text-surface-500"
                  )}
                >
                  {done ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                {i < STEP_ORDER.length - 1 && (
                  <div
                    className={cn(
                      "h-0.5 w-12 transition",
                      done ? "bg-brand" : "bg-surface-200"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="rounded-3xl border border-surface-200 bg-white shadow-elevated p-8 md:p-12">
          {step === "welcome" && (
            <WelcomeStep
              firstName={firstName}
              businessName={businessName}
              areaCity={areaCity}
              areaState={areaState}
              trialDaysLeft={trialDaysLeft}
              onNext={goNext}
            />
          )}
          {step === "api-key" && (
            <ApiKeyStep
              hasKey={savedKey}
              apiKey={apiKey}
              setApiKey={setApiKey}
              showKey={showKey}
              setShowKey={setShowKey}
              savingKey={savingKey}
              onSave={saveKey}
              onBack={goBack}
              onNext={goNext}
            />
          )}
          {step === "ready" && (
            <ReadyStep
              firstName={firstName}
              hasKey={savedKey}
              completing={completing}
              onBack={goBack}
              onComplete={onComplete}
            />
          )}
        </div>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={onComplete}
            disabled={completing}
            className="text-xs text-surface-500 hover:text-surface-800 underline-offset-4 hover:underline"
          >
            Skip for now — I&apos;ll set this up later
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Steps ----------

function WelcomeStep({
  firstName,
  businessName,
  areaCity,
  areaState,
  trialDaysLeft,
  onNext,
}: {
  firstName: string;
  businessName: string | null;
  areaCity: string | null;
  areaState: string | null;
  trialDaysLeft: number | null;
  onNext: () => void;
}) {
  return (
    <>
      <div className="inline-flex h-12 w-12 grid place-items-center rounded-2xl bg-brand text-brand-fg mb-4">
        <Rocket className="h-5 w-5" />
      </div>
      <h1 className="font-display text-4xl text-surface-900 leading-tight">
        Welcome aboard, {firstName}.
      </h1>
      <p className="mt-4 text-surface-600 leading-relaxed">
        You&apos;re all signed up{businessName ? ` as ${businessName}` : ""}
        {areaCity ? ` in ${areaCity}${areaState ? `, ${areaState}` : ""}` : ""}.
        {trialDaysLeft !== null && trialDaysLeft > 0 && (
          <> Your <strong>{trialDaysLeft}-day free trial</strong> has started.</>
        )}{" "}
        Here&apos;s how this works:
      </p>

      <div className="mt-8 space-y-4">
        <StepRow
          icon={<Search className="h-4 w-4" />}
          title="1. Find leads in your area"
          body="Search Google Places for local businesses without websites — restaurants, salons, HVAC, contractors. Save them to your pipeline."
        />
        <StepRow
          icon={<Hammer className="h-4 w-4" />}
          title="2. Build their site in minutes"
          body="Pre-fill from a lead, pick a template, let Claude AI draft the copy, click Create. Site goes live at a real URL you can hand to the prospect."
        />
        <StepRow
          icon={<CreditCard className="h-4 w-4" />}
          title="3. Close + get paid"
          body="Send the demo, send your invoice (one-time, monthly, or % of sales), get paid through Stripe."
        />
      </div>

      <Button onClick={onNext} size="lg" className="mt-8 w-full">
        Let&apos;s set it up <ArrowRight className="h-4 w-4" />
      </Button>
    </>
  );
}

function StepRow({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="h-9 w-9 grid place-items-center rounded-full bg-brand/10 text-brand shrink-0">
        {icon}
      </div>
      <div>
        <div className="font-medium text-surface-900">{title}</div>
        <p className="text-sm text-surface-600 mt-0.5 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

function ApiKeyStep({
  hasKey,
  apiKey,
  setApiKey,
  showKey,
  setShowKey,
  savingKey,
  onSave,
  onBack,
  onNext,
}: {
  hasKey: boolean;
  apiKey: string;
  setApiKey: (v: string) => void;
  showKey: boolean;
  setShowKey: (v: boolean) => void;
  savingKey: boolean;
  onSave: () => Promise<void>;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <>
      <div className="inline-flex h-12 w-12 grid place-items-center rounded-2xl bg-brand text-brand-fg mb-4">
        <Key className="h-5 w-5" />
      </div>
      <h1 className="font-display text-3xl md:text-4xl text-surface-900 leading-tight">
        Connect Google Places
      </h1>
      <p className="mt-4 text-surface-600 leading-relaxed">
        Lead-finding uses Google Places to surface local businesses without websites.
        You bring your own API key — Google bills your account directly (~$0.03 per
        search, so $30 covers about 1000 businesses).
      </p>

      <a
        href="https://console.cloud.google.com/google/maps-apis/credentials"
        target="_blank"
        rel="noreferrer"
        className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-surface-100 px-3.5 py-1.5 text-xs font-medium text-surface-700 hover:bg-surface-200 transition"
      >
        Get a Google Places API key
        <ExternalLink className="h-3 w-3" />
      </a>

      {hasKey ? (
        <div className="mt-6 rounded-2xl bg-emerald-50 ring-1 ring-emerald-200 p-4 flex items-center gap-3 text-sm text-emerald-900">
          <Check className="h-5 w-5 text-emerald-600" />
          <div>
            <div className="font-medium">API key saved</div>
            <div className="text-xs text-emerald-800 mt-0.5">
              You&apos;re ready to search for leads.
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="setup-key">Paste your API key</Label>
            <div className="relative">
              <Input
                id="setup-key"
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                autoComplete="off"
                placeholder="AIza…"
                className="pr-10 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-surface-500 hover:text-surface-800"
                aria-label={showKey ? "Hide" : "Show"}
              >
                {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
          <Button
            type="button"
            onClick={onSave}
            disabled={savingKey || !apiKey.trim()}
            size="md"
            className="w-full"
          >
            {savingKey && <Loader2 className="h-4 w-4 animate-spin" />}
            Save API key
          </Button>
        </div>
      )}

      <div className="mt-8 flex gap-2">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="flex-1" />
        <Button type="button" onClick={onNext}>
          {hasKey ? "Continue" : "Skip for now"} <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </>
  );
}

function ReadyStep({
  firstName,
  hasKey,
  completing,
  onBack,
  onComplete,
}: {
  firstName: string;
  hasKey: boolean;
  completing: boolean;
  onBack: () => void;
  onComplete: () => Promise<void>;
}) {
  return (
    <>
      <div className="inline-flex h-12 w-12 grid place-items-center rounded-2xl bg-brand text-brand-fg mb-4">
        <Sparkles className="h-5 w-5" />
      </div>
      <h1 className="font-display text-4xl text-surface-900 leading-tight">
        You&apos;re all set, {firstName}.
      </h1>
      <p className="mt-4 text-surface-600 leading-relaxed">
        Head to your dashboard to start finding leads
        {!hasKey && " (add your API key from Settings whenever you're ready)"}.
      </p>

      <div className="mt-8 grid gap-3">
        <div className="rounded-2xl border border-surface-200 bg-surface-50 p-4 flex items-start gap-3">
          <div className="h-8 w-8 grid place-items-center rounded-full bg-brand text-brand-fg shrink-0">
            <Search className="h-4 w-4" />
          </div>
          <div className="text-sm">
            <div className="font-medium text-surface-900">Your first move</div>
            <div className="text-surface-600 mt-0.5">
              From the dashboard, hit <strong>Find leads</strong>, enter your city, and
              pick a business type.
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-surface-200 bg-surface-50 p-4 flex items-start gap-3">
          <div className="h-8 w-8 grid place-items-center rounded-full bg-brand text-brand-fg shrink-0">
            <Hammer className="h-4 w-4" />
          </div>
          <div className="text-sm">
            <div className="font-medium text-surface-900">Build your first site</div>
            <div className="text-surface-600 mt-0.5">
              Open any lead → <strong>Build their site</strong>. Form pre-fills, AI
              writes the copy, you click Create.
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 flex gap-2">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="flex-1" />
        <Button type="button" onClick={onComplete} disabled={completing} size="lg">
          {completing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
          Go to dashboard
        </Button>
      </div>
    </>
  );
}
