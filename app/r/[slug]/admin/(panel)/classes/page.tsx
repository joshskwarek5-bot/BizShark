import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireRestaurantAdmin } from "@/lib/auth";
import { ClassesManager } from "@/components/admin/classes-manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Classes" };

export default async function ClassesPage({
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
  const [classes, instructors] = await Promise.all([
    db.classSession.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    }),
    db.staff.findMany({
      where: { restaurantId: restaurant.id, isActive: true },
      select: { id: true, name: true },
      orderBy: { displayOrder: "asc" },
    }),
  ]);

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-8 max-w-6xl">
      <ClassesManager
        slug={slug}
        classes={classes.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          dayOfWeek: c.dayOfWeek,
          startTime: c.startTime,
          endTime: c.endTime,
          instructorId: c.instructorId,
          capacity: c.capacity,
          level: c.level,
          bookingUrl: c.bookingUrl,
        }))}
        instructors={instructors}
      />
    </div>
  );
}
