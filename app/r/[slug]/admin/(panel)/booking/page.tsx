import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireRestaurantAdmin } from "@/lib/auth";
import { parseAppointmentConfig } from "@/lib/availability";
import { BookingConfigForm } from "@/components/admin/booking-config-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Booking settings" };

export default async function BookingConfigPage({
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
  const config = parseAppointmentConfig(restaurant.appointmentConfig);

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-8 max-w-3xl">
      <BookingConfigForm slug={slug} initial={config} hours={restaurant.hours} />
    </div>
  );
}
