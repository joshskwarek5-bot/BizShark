import Link from "next/link";
import { redirect } from "next/navigation";
import { Rocket } from "lucide-react";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  // Already signed in? Skip the form.
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

  return (
    <main className="min-h-screen bg-surface-50 grid place-items-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-10 w-10 grid place-items-center rounded-xl bg-brand text-brand-fg mb-3">
            <Rocket className="h-5 w-5" />
          </div>
          <h1 className="font-display text-4xl text-surface-900">Welcome back</h1>
          <p className="mt-2 text-sm text-surface-600">Sign in to your dashboard.</p>
        </div>
        <div className="rounded-3xl border border-surface-200 bg-white shadow-elevated p-8">
          <LoginForm />
        </div>
        <p className="mt-6 text-center text-sm text-surface-500">
          New here?{" "}
          <Link href="/signup" className="text-brand font-medium hover:underline">
            Start your free trial
          </Link>
        </p>
      </div>
    </main>
  );
}
