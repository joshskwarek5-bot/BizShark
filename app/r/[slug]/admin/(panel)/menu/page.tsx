import { notFound, redirect } from "next/navigation";
import { getRestaurantWithMenu } from "@/lib/restaurant";
import { clientTypeMeta } from "@/lib/client-type";
import { MenuManager } from "@/components/admin/menu-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Menu" };

export default async function AdminMenuPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const r = await getRestaurantWithMenu(slug);
  if (!r) notFound();
  if (!clientTypeMeta(r.type).hasMenu) redirect(`/r/${slug}/admin/services`);

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-8">
      <MenuManager
        slug={r.slug}
        categories={r.categories.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          items: c.items.map((i) => ({
            id: i.id,
            name: i.name,
            description: i.description,
            priceCents: i.priceCents,
            isAvailable: i.isAvailable,
            categoryId: i.categoryId,
          })),
        }))}
      />
    </div>
  );
}
