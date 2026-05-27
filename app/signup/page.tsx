import Link from "next/link";
import { redirect } from "next/navigation";
import { Rocket, Check, Clock, CreditCard, Sparkles } from "lucide-react";
import { getSession } from "@/lib/session";
import { SignupForm } from "./signup-form";

export const metadata = { title: "Start your agency · Sign up" };

export default async function SignupPage() {
  // Already signed in? Send to the right dashboard.
  const session = await getSession();
  if (session.userId) {
    if (session.role === "operator") redirect("/app");
    if (session.role === "super_admin") redirect("/platform");
    if (session.role === "restaurant_admin" && session.restaurantId) {
      // We don't have the slug in session — send to a generic page they can navigate from
      redirect("/");
    }
  }

  return (
    <main className="min-h-screen bg-surface-50 px-4 py-10 sm:py-16">
      <div className="mx-auto grid w-full max-w-5xl gap-10 lg:grid-cols-[1.05fr_1fr] lg:items-start">
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
            <Sparkles className="h-3.5 w-3.5" />
            3-day free trial · No credit card
          </div>
          <h1 className="mt-4 font-display text-4xl sm:text-5xl leading-[1.05] text-surface-900">
            Find local businesses without websites.
            <br />
            <span className="text-brand">Build them a polished site in minutes.</span>
            <br />
            Charge them what you want.
          </h1>
          <p className="mt-5 text-base text-surface-600 leading-relaxed">
            Spin up a one-person web agency from your laptop. We surface the prospects,
            generate the site, and bill the client — you keep 100% of what you charge.
          </p>

          <ul className="mt-7 grid gap-3 text-sm">
            <ProofRow icon={<Clock className="h-4 w-4" />}>
              <strong className="text-surface-900">10-minute first site</strong>
              <span className="text-surface-600"> — pre-filled from Google Places, polished by AI</span>
            </ProofRow>
            <ProofRow icon={<CreditCard className="h-4 w-4" />}>
              <strong className="text-surface-900">No credit card to start</strong>
              <span className="text-surface-600"> — 3 days of every feature, then $49/mo</span>
            </ProofRow>
            <ProofRow icon={<Check className="h-4 w-4" />}>
              <strong className="text-surface-900">Built for cold outreach</strong>
              <span className="text-surface-600"> — lead finder, pitch templates, Stripe invoicing</span>
            </ProofRow>
          </ul>

          <p className="mt-8 text-xs text-surface-500">
            Already have an account?{" "}
            <Link href="/login" className="text-brand font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>

        <div className="w-full max-w-md justify-self-center lg:justify-self-end">
          <div className="text-center lg:text-left mb-6 lg:hidden">
            <div className="inline-flex h-10 w-10 grid place-items-center rounded-xl bg-brand text-brand-fg">
              <Rocket className="h-5 w-5" />
            </div>
          </div>
          <div className="rounded-3xl border border-surface-200 bg-white shadow-elevated p-7 sm:p-8">
            <div className="hidden lg:flex items-center gap-2 mb-5">
              <div className="h-9 w-9 grid place-items-center rounded-xl bg-brand text-brand-fg">
                <Rocket className="h-4 w-4" />
              </div>
              <div>
                <div className="font-display text-lg text-surface-900 leading-none">Create your account</div>
                <div className="text-xs text-surface-500 mt-1">Trial starts the moment you sign up</div>
              </div>
            </div>
            <SignupForm />
          </div>
        </div>
      </div>
    </main>
  );
}

function ProofRow({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 grid h-7 w-7 place-items-center rounded-full bg-brand/10 text-brand shrink-0">
        {icon}
      </span>
      <span className="leading-snug">{children}</span>
    </li>
  );
}
