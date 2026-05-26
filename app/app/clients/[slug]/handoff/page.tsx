import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/auth";
import { HandoffCard, type LiveSetupLink } from "@/components/operator/handoff-card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Hand off to client" };

export default async function HandoffPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const auth = await requireOperator();
  if (!auth.authorized) redirect("/login");
  const { operator } = auth;

  const restaurant = await db.restaurant.findUnique({
    where: { slug },
    include: {
      _count: { select: { users: true } },
    },
  });
  if (!restaurant) notFound();
  if (restaurant.operatorId !== operator.id) notFound();

  const live = await db.setupLink.findFirst({
    where: {
      restaurantId: restaurant.id,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  const liveLink: LiveSetupLink | null = live && {
    id: live.id,
    token: live.token,
    email: live.email,
    name: live.name,
    expiresAt: live.expiresAt.toISOString(),
    usedAt: live.usedAt ? live.usedAt.toISOString() : null,
    createdAt: live.createdAt.toISOString(),
  };

  return (
    <div className="px-4 sm:px-6 lg:px-10 py-8 max-w-5xl">
      <Link
        href="/app/clients"
        className="inline-flex items-center gap-1.5 text-sm text-surface-600 hover:text-brand mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> All clients
      </Link>

      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div>
          <div className="text-xs font-mono uppercase tracking-widest text-brand">
            Client handoff
          </div>
          <h1 className="mt-2 font-display text-4xl text-surface-900">
            {restaurant.name}
          </h1>
          <p className="text-sm text-surface-500 mt-1">
            Give your client a one-time link so they can set a password and take
            over the admin.
          </p>
        </div>
      </div>

      <HandoffCard
        slug={restaurant.slug}
        restaurantName={restaurant.name}
        defaultEmail={restaurant.email ?? ""}
        currentAdminCount={restaurant._count.users}
        liveLink={liveLink}
      />
    </div>
  );
}
