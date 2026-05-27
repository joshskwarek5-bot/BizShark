import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireRestaurantAdmin } from "@/lib/auth";
import { InquiriesInbox } from "@/components/admin/inquiries-inbox";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inquiries" };

export default async function InquiriesPage({
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

  const inquiries = await db.inquiry.findMany({
    where: { restaurantId: restaurant.id },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
  });

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="font-display text-4xl text-surface-900">Inquiries</h1>
        <p className="text-sm text-surface-500 mt-1">
          Quote requests, contact form messages, and appointment requests from
          your public site.
        </p>
      </div>
      <InquiriesInbox
        slug={slug}
        inquiries={inquiries.map((i) => ({
          id: i.id,
          kind: i.kind,
          status: i.status,
          customerName: i.customerName,
          customerEmail: i.customerEmail,
          customerPhone: i.customerPhone,
          message: i.message,
          serviceRequested: i.serviceRequested,
          preferredDate: i.preferredDate,
          preferredTime: i.preferredTime,
          address: i.address,
          notes: i.notes,
          createdAt: i.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
