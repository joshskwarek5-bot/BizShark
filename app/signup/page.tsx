import Link from "next/link";
import { redirect } from "next/navigation";
import { Rocket } from "lucide-react";
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
    <main className="min-h-screen bg-surface-50 grid place-items-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-10 w-10 grid place-items-center rounded-xl bg-brand text-brand-fg mb-3">
            <Rocket className="h-5 w-5" />
          </div>
          <h1 className="font-display text-4xl text-surface-900">
            Quit your 9-to-5
          </h1>
          <p className="mt-2 text-sm text-surface-600 max-w-sm mx-auto">
            Find local businesses without websites, build them sites in minutes, and pitch
            them for what you want to charge.
          </p>
        </div>
        <div className="rounded-3xl border border-surface-200 bg-white shadow-elevated p-8">
          <SignupForm />
        </div>
        <p className="mt-6 text-center text-sm text-surface-500">
          Already have an account?{" "}
          <Link href="/login" className="text-brand font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
