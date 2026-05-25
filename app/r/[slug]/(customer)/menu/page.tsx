import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getRestaurantWithMenu } from "@/lib/restaurant";
import { MenuNav } from "@/components/restaurant/menu-nav";
import { MenuItemCard } from "@/components/restaurant/menu-item-card";

export default async function MenuPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const r = await getRestaurantWithMenu(slug);
  if (!r) notFound();

  const visibleCategories = r.categories.filter((c) => c.items.length > 0);

  return (
    <div className="bg-surface-50">
      <section className="relative overflow-hidden bg-white border-b border-surface-200">
        <div className="absolute inset-0 grain opacity-50" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-14 md:py-20">
          <div className="text-xs font-mono uppercase tracking-widest text-brand">Menu</div>
          <h1 className="mt-2 font-display text-5xl md:text-6xl text-surface-900">
            What&apos;s on today
          </h1>
          <p className="mt-4 text-surface-600 max-w-xl leading-relaxed">
            Made fresh, served fast. Add items to your order, then head to checkout when
            you&apos;re ready — payment is at pickup.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-2">
        <MenuNav categories={visibleCategories.map((c) => ({ id: c.id, name: c.name }))} />

        <div className="py-8 grid gap-14 md:gap-20">
          {visibleCategories.map((cat) => (
            <section key={cat.id} id={`cat-${cat.id}`} className="scroll-mt-32">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <h2 className="font-display text-3xl md:text-4xl text-surface-900">
                    {cat.name}
                  </h2>
                  {cat.description && (
                    <p className="mt-1.5 text-sm text-surface-600 max-w-2xl">
                      {cat.description}
                    </p>
                  )}
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {cat.items.map((item) => (
                  <MenuItemCard key={item.id} slug={r.slug} item={item} />
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="my-16 rounded-3xl bg-gradient-to-br from-brand to-brand p-1">
          <div className="rounded-[20px] bg-white p-8 md:p-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="font-display text-3xl md:text-4xl text-surface-900">
                Ready to wrap it up?
              </div>
              <p className="mt-2 text-surface-600 max-w-lg">
                Review your order and pick a time to swing by — your food will be ready and waiting.
              </p>
            </div>
            <Link
              href={`/r/${r.slug}/checkout`}
              className="inline-flex h-14 items-center gap-2 rounded-full bg-brand pl-7 pr-5 text-base font-medium text-brand-fg shadow-elevated active:scale-[0.98] transition"
            >
              Go to checkout
              <span className="grid h-9 w-9 place-items-center rounded-full bg-white/20">
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
