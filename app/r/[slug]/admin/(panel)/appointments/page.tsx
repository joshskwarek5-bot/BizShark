import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireRestaurantAdmin } from "@/lib/auth";
import { AppointmentsInbox } from "@/components/admin/appointments-inbox";

export const dynamic = "force-dynamic";
export const metadata = { title: "Appointments" };

export default async function AppointmentsPage({
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

  const appts = await db.appointment.findMany({
    where: { restaurantId: restaurant.id },
    orderBy: [{ status: "asc" }, { startsAt: "asc" }],
    take: 200,
  });

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-8 max-w-5xl">
      <AppointmentsInbox
        slug={slug}
        appointments={appts.map((a) => ({
          id: a.id,
          startsAt: a.startsAt.toISOString(),
          endsAt: a.endsAt.toISOString(),
          serviceName: a.serviceName,
          serviceDurationMinutes: a.serviceDurationMinutes,
          status: a.status,
          customerName: a.customerName,
          customerEmail: a.customerEmail,
          customerPhone: a.customerPhone,
          notes: a.notes,
          adminNotes: a.adminNotes,
          createdAt: a.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
