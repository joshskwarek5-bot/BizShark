import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";

export default async function RootPage() {
  const primary = await db.restaurant.findFirst({
    where: { isPrimary: true, isActive: true },
  });
  if (primary) redirect(`/r/${primary.slug}`);

  const all = await db.restaurant.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  return (
    <main className="min-h-screen bg-surface-50">
      <Container size="sm" className="py-24">
        <h1 className="font-display text-5xl md:text-6xl text-surface-900">
          Restaurant Platform
        </h1>
        <p className="mt-4 text-surface-600 text-lg">
          Modern websites and online ordering. Pick a restaurant to visit, or
          sign in to your dashboard.
        </p>

        <div className="mt-12 grid gap-3">
          {all.length === 0 && (
            <div className="rounded-2xl border border-dashed border-surface-300 bg-surface-100 p-8 text-center text-surface-500">
              No restaurants yet. Sign in to the platform admin to add one.
            </div>
          )}
          {all.map((r) => (
            <Link
              key={r.id}
              href={`/r/${r.slug}`}
              className="flex items-center justify-between rounded-2xl border border-surface-200 bg-white px-6 py-5 shadow-soft hover:shadow-elevated transition"
            >
              <div>
                <div className="font-display text-xl text-surface-900">{r.name}</div>
                <div className="text-sm text-surface-500">
                  {r.address}
                  {r.city ? `, ${r.city}` : ""}
                </div>
              </div>
              <span className="text-sm text-brand">Visit →</span>
            </Link>
          ))}
        </div>

        <div className="mt-12 flex gap-3">
          <Button asChild variant="outline">
            <Link href="/platform/login">Platform admin</Link>
          </Button>
        </div>
      </Container>
    </main>
  );
}
