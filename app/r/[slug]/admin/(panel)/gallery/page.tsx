import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireRestaurantAdmin } from "@/lib/auth";
import { GalleryManager } from "@/components/admin/gallery-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Gallery" };

export default async function GalleryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const auth = await requireRestaurantAdmin(slug);
  if (!auth.authorized) {
    if (auth.reason === "unauthenticated") redirect(`/r/${slug}/admin/login`);
    notFound();
  }
  const restaurant = auth.restaurant;
  const images = await db.galleryImage.findMany({
    where: { restaurantId: restaurant.id },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-8 max-w-5xl">
      <GalleryManager
        slug={slug}
        clientType={restaurant.type}
        images={images.map((i) => ({
          id: i.id,
          imageUrl: i.imageUrl,
          caption: i.caption,
          tag: i.tag,
        }))}
      />
    </div>
  );
}
