import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireRestaurantAdmin } from "@/lib/auth";
import { TeamManager } from "@/components/admin/team-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Team" };

export default async function TeamPage({
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
  const staff = await db.staff.findMany({
    where: { restaurantId: restaurant.id },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
  });

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-8 max-w-5xl">
      <TeamManager
        slug={slug}
        clientType={restaurant.type}
        staff={staff.map((s) => ({
          id: s.id,
          name: s.name,
          title: s.title,
          bio: s.bio,
          photoUrl: s.photoUrl,
          specialties: parseSpecialties(s.specialties),
          bookingUrl: s.bookingUrl,
          instagram: s.instagram,
          yearsExperience: s.yearsExperience,
          isActive: s.isActive,
        }))}
      />
    </div>
  );
}

function parseSpecialties(raw: string): string[] {
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr)
      ? arr.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}
