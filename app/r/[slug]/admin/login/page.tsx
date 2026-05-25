import Link from "next/link";
import { notFound } from "next/navigation";
import { getRestaurantBySlug } from "@/lib/restaurant";
import { LoginForm } from "./login-form";

export const metadata = { title: "Staff login" };

export default async function AdminLoginPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const r = await getRestaurantBySlug(slug);
  if (!r) notFound();

  return (
    <main className="min-h-screen bg-surface-50 grid place-items-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link
            href={`/r/${slug}`}
            className="font-display text-2xl text-surface-900 hover:text-brand transition"
          >
            {r.name}
          </Link>
          <p className="mt-2 text-sm text-surface-600">Staff login</p>
        </div>
        <div className="rounded-3xl border border-surface-200 bg-white shadow-elevated p-8">
          <LoginForm slug={slug} />
        </div>
        <p className="mt-6 text-center text-xs text-surface-500">
          Lost access? Contact your platform administrator.
        </p>
      </div>
    </main>
  );
}
