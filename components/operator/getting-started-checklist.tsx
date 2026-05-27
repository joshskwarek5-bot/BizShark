"use client";

import * as React from "react";
import Link from "next/link";
import {
  Check,
  Key,
  Search,
  Plus,
  Wand2,
  Image as ImageIcon,
  CreditCard,
  Send,
  ChevronDown,
  ChevronUp,
  Rocket,
  Circle,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChecklistState {
  hasGooglePlacesKey: boolean;
  hasOpenAIKey: boolean;
  hasStripeKey: boolean;
  leadCount: number;
  clientCount: number;
  hasAnyMenuItem: boolean;
  hasAnyHeroImage: boolean;
  hasAnyBilling: boolean;
  hasAnyHandoff: boolean;
}

interface StepDef {
  key: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  done: boolean;
  /** Headline shown when expanded. */
  why: string;
  /** Step-by-step "how" — concrete, opinionated. */
  how: string[];
  /** Where to go to actually do it. */
  href: string;
  cta: string;
}

interface Props {
  state: ChecklistState;
}

export function GettingStartedChecklist({ state }: Props) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [openStep, setOpenStep] = React.useState<string | null>(null);

  const steps: StepDef[] = [
    {
      key: "google-key",
      title: "Add your Google Places API key",
      icon: Key,
      done: state.hasGooglePlacesKey,
      why: "Powers the lead finder. You bring your own key — Google bills you ~$0.03 per search.",
      how: [
        "Go to console.cloud.google.com → APIs & Services → Credentials.",
        "Enable the 'Places API (New)' on your project.",
        "Create an API key (no restrictions for testing).",
        "Paste it into Settings → Google Places.",
      ],
      href: "/app/settings",
      cta: "Add key in Settings",
    },
    {
      key: "find-leads",
      title: "Find your first leads",
      icon: Search,
      done: state.leadCount > 0,
      why: "Search a city + business type. We pull local businesses from Google, filter out anyone with a real website, and save the rest as leads.",
      how: [
        "Open the Leads tab and click 'Find leads'.",
        "Type a CITY only (e.g. 'Golden, CO') in the first field — no business type.",
        "Pick the business type below (restaurant, salon, plumber, etc.).",
        "Keep 'Only no-website' on for your highest-value prospects.",
        "We save up to your tier's lead cap (15/50/250).",
      ],
      href: "/app/leads",
      cta: "Open lead finder",
    },
    {
      key: "create-client",
      title: "Build a site for your first client",
      icon: Plus,
      done: state.clientCount > 0,
      why: "Click any lead and 'Convert to client' — most fields auto-fill from Google. Or add manually if you already have one.",
      how: [
        "From a lead detail page, click 'Convert to client'.",
        "Or go to Clients → New client.",
        "Write a short brief about the restaurant in the AI Assist box.",
        "Click 'Generate copy' — Claude writes the hero + about copy from your brief.",
        "Edit anything before saving.",
      ],
      href: "/app/clients/new",
      cta: "Add a client",
    },
    {
      key: "import-menu",
      title: "Import the menu in one paste",
      icon: Wand2,
      done: state.hasAnyMenuItem,
      why: "Drop in raw menu text — PDF copy, photo OCR, the old website. Claude parses sections, items, descriptions, and prices in ~20 seconds.",
      how: [
        "Go to the client's admin → Menu tab.",
        "Click 'Import with AI'.",
        "Paste the full menu (up to 40,000 characters).",
        "Click 'Parse with AI' — preview screen appears.",
        "Edit any item, then 'Import' to commit to the database.",
      ],
      href: state.clientCount > 0 ? "/app/clients" : "/app/clients/new",
      cta: state.clientCount > 0 ? "Open a client" : "Create a client first",
    },
    {
      key: "openai-key",
      title: "Add an OpenAI key for AI images",
      icon: ImageIcon,
      done: state.hasOpenAIKey,
      why: "Unlocks 'Enhance with AI' on hero images and menu items. Drop in reference photos, get polished, on-brand visuals.",
      how: [
        "Get a key at platform.openai.com/api-keys.",
        "Paste it into Settings → OpenAI.",
        "On any menu item or the hero image, click 'Enhance with AI'.",
        "Drop in 1–3 reference photos (Google Images, phone pics).",
        "Generate. Result auto-saves to that image slot. (~$0.04–0.19 each)",
      ],
      href: "/app/settings",
      cta: "Add OpenAI key",
    },
    {
      key: "hero-image",
      title: "Generate or upload a hero image",
      icon: ImageIcon,
      done: state.hasAnyHeroImage,
      why: "The big atmospheric image at the top of the public site. Drop in 1–3 real photos — AI turns them into a polished banner.",
      how: [
        "Client admin → Settings → Hero banner card.",
        "Either upload a photo manually or click 'Enhance with AI'.",
        "For AI: drop in 1–3 Google Images of the place + a short prompt.",
        "Click Generate — appears on the public site immediately.",
      ],
      href: state.clientCount > 0 ? "/app/clients" : "/app/clients/new",
      cta: state.clientCount > 0 ? "Open client settings" : "Create a client first",
    },
    {
      key: "stripe-key",
      title: "Connect Stripe to bill clients",
      icon: CreditCard,
      done: state.hasStripeKey,
      why: "Send a hosted payment link (one-time invoice or recurring subscription). Money lands directly in YOUR Stripe — we don't take a cut.",
      how: [
        "Get your Secret Key at dashboard.stripe.com/apikeys.",
        "Paste into Settings → Stripe.",
        "On any client → Billing → enter an amount → click Charge.",
        "Share the payment link (text/email/in person).",
        "For recurring: pick Monthly, then 'Start subscription'.",
      ],
      href: "/app/settings",
      cta: "Connect Stripe",
    },
    {
      key: "first-bill",
      title: "Send your first invoice",
      icon: Send,
      done: state.hasAnyBilling,
      why: "Once Stripe is connected, charging is one click. Get paid before you hand off.",
      how: [
        "Open any client → Billing tab.",
        "Enter the amount (e.g. $500 setup fee).",
        "Toggle 'Also email via Stripe' if you want Stripe to email them too.",
        "Click Charge — you get a shareable payment link.",
      ],
      href: state.clientCount > 0 ? "/app/clients" : "/app/clients/new",
      cta: state.clientCount > 0 ? "Open client billing" : "Create a client first",
    },
    {
      key: "handoff",
      title: "Hand off the site to the client",
      icon: Rocket,
      done: state.hasAnyHandoff,
      why: "Generate a one-time link the client uses to set their password. They take over their admin; you keep oversight via super-admin.",
      how: [
        "Client page → Handoff tab.",
        "Enter their email, click 'Generate setup link'.",
        "Copy the link or the suggested email and send it.",
        "Link works once and expires after 7 days — regenerate any time.",
      ],
      href: state.clientCount > 0 ? "/app/clients" : "/app/clients/new",
      cta: state.clientCount > 0 ? "Open a client" : "Create a client first",
    },
  ];

  const done = steps.filter((s) => s.done).length;
  const total = steps.length;
  const pct = Math.round((done / total) * 100);
  const allDone = done === total;

  // Auto-collapse once everything is done (still kept for replay)
  React.useEffect(() => {
    if (allDone) setCollapsed(true);
  }, [allDone]);

  return (
    <section className="mb-8 rounded-3xl border border-surface-200 bg-gradient-to-br from-brand/5 via-white to-white shadow-soft overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full px-6 md:px-8 py-5 flex items-center justify-between gap-4 text-left"
      >
        <div className="flex items-center gap-4 min-w-0">
          <div
            className={cn(
              "h-12 w-12 grid place-items-center rounded-2xl shrink-0",
              allDone ? "bg-emerald-100 text-emerald-700" : "bg-brand text-brand-fg"
            )}
          >
            {allDone ? <Check className="h-6 w-6" /> : <Rocket className="h-6 w-6" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-display text-2xl text-surface-900">
                {allDone ? "You're set up" : "Get to your first paying client"}
              </h2>
              <span className="text-xs font-medium tabular-nums text-surface-500">
                {done} / {total} steps
              </span>
            </div>
            <p className="text-sm text-surface-600 mt-0.5 truncate">
              {allDone
                ? "All milestones complete. Expand to revisit any step."
                : "Step-by-step walkthrough: find a lead → build the site → import their menu → drop in photos → pitch + bill."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex w-24 h-2 rounded-full bg-surface-100 overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-500",
                allDone ? "bg-emerald-500" : "bg-brand"
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          {collapsed ? (
            <ChevronDown className="h-5 w-5 text-surface-500" />
          ) : (
            <ChevronUp className="h-5 w-5 text-surface-500" />
          )}
        </div>
      </button>

      {!collapsed && (
        <div className="border-t border-surface-100 divide-y divide-surface-100">
          {steps.map((step, idx) => (
            <StepRow
              key={step.key}
              index={idx + 1}
              step={step}
              open={openStep === step.key}
              onToggle={() =>
                setOpenStep((s) => (s === step.key ? null : step.key))
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}

function StepRow({
  index,
  step,
  open,
  onToggle,
}: {
  index: number;
  step: StepDef;
  open: boolean;
  onToggle: () => void;
}) {
  const Icon = step.icon;
  return (
    <div
      className={cn(
        "transition-colors",
        step.done ? "bg-emerald-50/30" : "bg-white"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-6 md:px-8 py-4 flex items-center gap-4 text-left hover:bg-surface-50/60 transition"
      >
        <div
          className={cn(
            "h-8 w-8 grid place-items-center rounded-full shrink-0 ring-1",
            step.done
              ? "bg-emerald-500 text-white ring-emerald-500"
              : "bg-white text-surface-500 ring-surface-300"
          )}
        >
          {step.done ? <Check className="h-4 w-4" /> : <Circle className="h-3 w-3" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-surface-400 tabular-nums">
              {String(index).padStart(2, "0")}
            </span>
            <span
              className={cn(
                "font-medium",
                step.done ? "text-surface-700" : "text-surface-900"
              )}
            >
              {step.title}
            </span>
            <Icon
              className={cn(
                "h-4 w-4 shrink-0",
                step.done ? "text-emerald-600" : "text-surface-400"
              )}
            />
          </div>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-surface-400 shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-surface-400 shrink-0" />
        )}
      </button>

      {open && (
        <div className="px-6 md:px-8 pb-5 -mt-1">
          <div className="ml-12 max-w-2xl space-y-3">
            <p className="text-sm text-surface-700">{step.why}</p>
            <div className="rounded-2xl bg-white ring-1 ring-surface-200 p-4">
              <div className="text-xs font-medium uppercase tracking-wider text-surface-500 mb-2">
                How to
              </div>
              <ol className="text-sm text-surface-700 space-y-1.5 list-decimal pl-5">
                {step.how.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ol>
            </div>
            <Link
              href={step.href}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-brand text-brand-fg px-4 text-sm font-medium shadow-soft hover:brightness-105 transition"
            >
              {step.cta} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
