import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Sparkles,
  Search,
  Hammer,
  Phone,
  Check,
  Rocket,
  ShieldCheck,
  Star,
  Users,
} from "lucide-react";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { TIER_IDS, TIERS } from "@/lib/subscriptions";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "BizShark — Quit your 9-to-5 building local websites",
  description:
    "Find local businesses without websites in your area, spin up polished sites in minutes, and pitch them for whatever you want to charge.",
};

export default async function MarketingHome() {
  // Signed-in visitors go to their dashboard
  const session = await getSession();
  if (session.userId) {
    if (session.role === "operator") redirect("/app");
    if (session.role === "super_admin") redirect("/platform");
    if (session.role === "restaurant_admin" && session.restaurantId) {
      const r = await db.restaurant.findUnique({
        where: { id: session.restaurantId },
        select: { slug: true },
      });
      if (r) redirect(`/r/${r.slug}/admin`);
    }
  }

  // For the live-sample section we surface the platform-admin's primary
  // restaurant (Mama Bears, by default). Falls back to any active one.
  const sample =
    (await db.restaurant.findFirst({
      where: { isPrimary: true, isActive: true },
      select: { slug: true, name: true, city: true, state: true, heroImageUrl: true },
    })) ??
    (await db.restaurant.findFirst({
      where: { isActive: true },
      select: { slug: true, name: true, city: true, state: true, heroImageUrl: true },
    }));

  return (
    <main className="min-h-screen bg-surface-50">
      <MarketingNav />
      <Hero />
      <HowItWorks />
      {sample && <SampleSite sample={sample} />}
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}

// ---------- Sections ----------

function MarketingNav() {
  return (
    <nav className="sticky top-0 z-40 border-b border-surface-200/70 bg-surface-50/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/brand/bizshark-logo.jpeg"
            alt="BizShark"
            width={128}
            height={32}
            priority
            className="h-8 w-auto rounded-md"
          />
        </Link>
        <div className="hidden md:flex items-center gap-1">
          <a
            href="#how"
            className="text-sm font-medium text-surface-600 hover:text-surface-900 px-3 py-2"
          >
            How it works
          </a>
          <a
            href="#pricing"
            className="text-sm font-medium text-surface-600 hover:text-surface-900 px-3 py-2"
          >
            Pricing
          </a>
          <a
            href="#faq"
            className="text-sm font-medium text-surface-600 hover:text-surface-900 px-3 py-2"
          >
            FAQ
          </a>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden sm:inline-flex h-10 items-center px-4 text-sm font-medium text-surface-700 hover:text-surface-900"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-medium text-brand-fg shadow-soft active:scale-[0.98] transition"
          >
            Start free
          </Link>
        </div>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 grain opacity-50" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-20 md:py-32 text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
          <Sparkles className="h-3 w-3" /> 3-day free trial · No credit card
        </div>
        <h1 className="mt-6 font-display text-5xl md:text-7xl tracking-tight text-surface-900 max-w-4xl mx-auto leading-[1.05]">
          Quit your 9-to-5 building <span className="text-brand">local-business</span>{" "}
          websites
        </h1>
        <p className="mt-6 text-lg md:text-xl text-surface-700 max-w-2xl mx-auto leading-relaxed">
          Find businesses without websites in your area. Spin up polished sites in
          minutes. Pitch them for whatever you want to charge. Keep 100% of the revenue.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link
            href="/signup"
            className="group inline-flex h-14 items-center gap-2 rounded-full bg-brand pl-7 pr-5 text-base font-medium text-brand-fg shadow-elevated hover:shadow-elevated transition active:scale-[0.98]"
          >
            Start free trial
            <span className="grid h-9 w-9 place-items-center rounded-full bg-white/20 transition group-hover:translate-x-0.5">
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
          <a
            href="#how"
            className="inline-flex h-14 items-center rounded-full border border-surface-300 bg-white px-7 text-base font-medium text-surface-800 hover:bg-surface-100 transition"
          >
            See how it works
          </a>
        </div>
        <div className="mt-14 grid grid-cols-3 max-w-2xl mx-auto gap-6 text-center">
          <Stat number="<10 min" label="To build a polished site" />
          <Stat number="$200-2k" label="Typical price per build" />
          <Stat number="100%" label="You keep what you charge" />
        </div>
      </div>
    </section>
  );
}

function Stat({ number, label }: { number: string; label: string }) {
  return (
    <div>
      <div className="font-display text-2xl md:text-3xl text-surface-900">{number}</div>
      <div className="mt-1 text-xs text-surface-600">{label}</div>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    {
      icon: Search,
      title: "1. Find leads in your area",
      body: "Search Google Places for restaurants, salons, HVAC companies, contractors — filtered to only show businesses that don't have a website yet. Your highest-value prospects.",
    },
    {
      icon: Hammer,
      title: "2. Build their site in minutes",
      body: "Pre-fill the new-client form straight from a lead. Pick a template (Modern or Classic). Claude AI writes the copy from a short brief. Hit Create — site live.",
    },
    {
      icon: Phone,
      title: "3. Pitch + close",
      body: "Send a pre-written email from your template library (their name, city, business already merged in). Call the number we surfaced. Show them the demo site. Close them at the price you set.",
    },
  ];
  return (
    <section id="how" className="py-20 md:py-28 bg-white border-y border-surface-200">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="text-xs font-mono uppercase tracking-widest text-brand">
            How it works
          </div>
          <h2 className="mt-2 font-display text-4xl md:text-5xl text-surface-900">
            Three steps to your first paying client
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.title}
                className="rounded-3xl border border-surface-200 bg-surface-50 p-7"
              >
                <div className="h-12 w-12 grid place-items-center rounded-full bg-brand text-brand-fg shadow-soft">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 font-display text-2xl text-surface-900">
                  {s.title}
                </h3>
                <p className="mt-3 text-surface-600 leading-relaxed">{s.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function SampleSite({
  sample,
}: {
  sample: { slug: string; name: string; city: string | null; state: string | null; heroImageUrl: string | null };
}) {
  return (
    <section className="py-20 md:py-28 bg-surface-50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-brand">
            Sample built on BizShark
          </div>
          <h2 className="mt-2 font-display text-4xl md:text-5xl text-surface-900">
            This is what your clients get
          </h2>
          <p className="mt-5 text-lg text-surface-700 leading-relaxed">
            {sample.name}
            {sample.city && ` in ${sample.city}`} — a real working site with menu, online
            ordering (Stripe), real-time order pipeline for the kitchen, and a one-tap
            admin for the owner.
          </p>
          <div className="mt-6 grid gap-2 text-sm">
            <Bullet>Themed per client (colors, fonts, layout)</Bullet>
            <Bullet>Online ordering with Stripe Connect built in</Bullet>
            <Bullet>Image uploads (Vercel Blob)</Bullet>
            <Bullet>Live order pipeline for the kitchen (no refresh needed)</Bullet>
            <Bullet>Customer-facing site indexable by Google for SEO</Bullet>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={`/r/${sample.slug}`}
              target="_blank"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-surface-900 px-6 text-sm font-medium text-surface-50 hover:bg-surface-800 transition"
            >
              View live sample
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
        <div className="relative aspect-[5/4] rounded-3xl overflow-hidden shadow-elevated">
          {sample.heroImageUrl ? (
            <Image
              src={sample.heroImageUrl}
              alt={sample.name}
              fill
              sizes="(max-width: 1024px) 100vw, 540px"
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-surface-200 grid place-items-center text-surface-500 font-display text-2xl">
              {sample.name}
            </div>
          )}
          <div className="absolute bottom-4 left-4 right-4 rounded-2xl bg-white/95 backdrop-blur p-4 shadow-soft">
            <div className="font-display text-lg text-surface-900">{sample.name}</div>
            <div className="text-xs text-surface-500 truncate">
              /r/{sample.slug}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
      <span className="text-surface-700">{children}</span>
    </div>
  );
}

function Pricing() {
  // Source of truth lives in lib/subscriptions.ts — marketing copy stays in sync.
  const tiers = TIER_IDS.map((id) => {
    const t = TIERS[id];
    return {
      name: t.name,
      price: `$${t.priceMonthly}`,
      cadence: "per month",
      desc: t.blurb,
      highlights: t.features,
      featured: t.featured ?? false,
      cta: "Start free trial",
    };
  });
  return (
    <section id="pricing" className="py-20 md:py-28 bg-white border-y border-surface-200">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <div className="text-xs font-mono uppercase tracking-widest text-brand">
            Pricing
          </div>
          <h2 className="mt-2 font-display text-4xl md:text-5xl text-surface-900">
            Pay yourself first
          </h2>
          <p className="mt-4 text-surface-600 max-w-xl mx-auto">
            Charge clients whatever you want — we don&apos;t take a cut. The subscription
            covers the platform.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={
                t.featured
                  ? "rounded-3xl bg-surface-900 text-surface-50 p-8 shadow-elevated relative"
                  : "rounded-3xl border border-surface-200 bg-surface-50 p-8"
              }
            >
              {t.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-brand px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-brand-fg">
                  Most popular
                </div>
              )}
              <div className="font-display text-2xl">{t.name}</div>
              <div className="mt-1 text-sm opacity-70">{t.desc}</div>
              <div className="mt-6">
                <span className="font-display text-5xl">{t.price}</span>
                <span className="ml-2 text-sm opacity-70">{t.cadence}</span>
              </div>
              <ul className="mt-6 space-y-2 text-sm">
                {t.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2">
                    <Check
                      className={
                        t.featured
                          ? "h-4 w-4 text-emerald-300 shrink-0 mt-0.5"
                          : "h-4 w-4 text-emerald-600 shrink-0 mt-0.5"
                      }
                    />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className={
                  t.featured
                    ? "mt-8 inline-flex h-12 w-full items-center justify-center rounded-full bg-brand px-6 text-sm font-medium text-brand-fg shadow-soft hover:brightness-105 transition"
                    : "mt-8 inline-flex h-12 w-full items-center justify-center rounded-full border border-surface-900 bg-transparent px-6 text-sm font-medium text-surface-900 hover:bg-surface-900 hover:text-surface-50 transition"
                }
              >
                {t.cta}
              </Link>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center text-xs text-surface-500">
          All plans include a 3-day free trial. Cancel any time, no contract.
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const faqs = [
    {
      q: "Do I really keep 100% of what I charge clients?",
      a: "Yes. The subscription covers your access to the platform. What your clients pay you for the websites you build is yours. We don't touch it.",
    },
    {
      q: "What if I don't know how to code?",
      a: "You don't need to. The whole point: every site is generated from a form. Pick a template, fill in the business's info, click Create. The site goes live at a real URL you can hand to the client.",
    },
    {
      q: "Where does lead data come from?",
      a: "Google Places — official, accurate, and includes a 'website' field so we can filter to only businesses that don't have one. You bring your own Google API key; Google bills you directly (~$0.03 per search, so $30 covers about 1000 businesses).",
    },
    {
      q: "Can clients take real card payments?",
      a: "Yes. Restaurants connect their own Stripe account (Express, ~10 minutes); customers pay on the site; money goes straight to the restaurant's bank. No platform middleman.",
    },
    {
      q: "How does the AI work?",
      a: "When you create a new client, you can paste a short brief about the business (\"family-owned Italian, been open 12 years, known for handmade pasta\") and Claude writes the tagline, about section, services list, and picks a color palette. You edit anything before saving.",
    },
    {
      q: "Can I get more website templates?",
      a: "We launch with Modern and Classic. More on the way. Agency-tier subscribers can request a custom template built for their niche.",
    },
  ];
  return (
    <section id="faq" className="py-20 md:py-28 bg-surface-50">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="text-xs font-mono uppercase tracking-widest text-brand">
            FAQ
          </div>
          <h2 className="mt-2 font-display text-4xl md:text-5xl text-surface-900">
            Questions, answered
          </h2>
        </div>
        <div className="space-y-4">
          {faqs.map((f) => (
            <details
              key={f.q}
              className="group rounded-2xl border border-surface-200 bg-white p-5 hover:shadow-soft transition"
            >
              <summary className="cursor-pointer list-none flex items-center justify-between gap-4">
                <span className="font-display text-lg text-surface-900">{f.q}</span>
                <span className="text-surface-400 text-xl group-open:rotate-45 transition">
                  +
                </span>
              </summary>
              <p className="mt-4 text-surface-700 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="py-20 md:py-28 bg-surface-900 text-white">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
        <div className="inline-flex h-12 w-12 grid place-items-center rounded-full bg-white text-surface-900 mb-6">
          <Rocket className="h-5 w-5" />
        </div>
        <h2 className="font-display text-4xl md:text-5xl">Your next paycheck is on Main Street</h2>
        <p className="mt-5 text-lg text-white/80 max-w-xl mx-auto">
          Sign up free. Spin up your first site in the next ten minutes. Pitch the local
          spot you walk past every day.
        </p>
        <div className="mt-10">
          <Link
            href="/signup"
            className="group inline-flex h-14 items-center gap-2 rounded-full bg-brand pl-7 pr-5 text-base font-medium text-brand-fg shadow-elevated"
          >
            Start your 3-day free trial
            <span className="grid h-9 w-9 place-items-center rounded-full bg-white/20 transition group-hover:translate-x-0.5">
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        </div>
        <div className="mt-6 inline-flex items-center gap-1.5 text-xs text-white/60">
          <ShieldCheck className="h-3.5 w-3.5" /> No credit card · Cancel any time
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-surface-200 bg-surface-50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10 flex items-center justify-between text-sm text-surface-500 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Image
            src="/brand/bizshark-logo.jpeg"
            alt="BizShark"
            width={112}
            height={28}
            className="h-7 w-auto rounded-md"
          />
        </div>
        <div className="flex items-center gap-5">
          <Link href="/login" className="hover:text-surface-900">
            Sign in
          </Link>
          <Link href="/signup" className="hover:text-surface-900">
            Start free
          </Link>
          <a href="#pricing" className="hover:text-surface-900">
            Pricing
          </a>
        </div>
        <div className="text-xs">
          © {new Date().getFullYear()} BizShark. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
