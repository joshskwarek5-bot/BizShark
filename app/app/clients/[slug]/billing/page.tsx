import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/auth";
import { type BillingMode } from "@/lib/client-billing";
import { ClientBillingCard } from "@/components/operator/client-billing-card";

export const dynamic = "force-dynamic";

export default async function ClientBillingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const auth = await requireOperator();
  if (!auth.authorized) redirect("/login");
  const { operator } = auth;

  const restaurant = await db.restaurant.findUnique({ where: { slug } });
  if (!restaurant) notFound();
  if (restaurant.operatorId !== operator.id) notFound();

  const billing = await db.clientBilling.findUnique({
    where: { restaurantId: restaurant.id },
  });
  const invoices = await db.clientInvoice.findMany({
    where: { restaurantId: restaurant.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

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
            Client billing
          </div>
          <h1 className="mt-2 font-display text-4xl text-surface-900">
            {restaurant.name}
          </h1>
          <p className="text-sm text-surface-500 mt-1">
            How YOU charge this client for the website you built them.
          </p>
        </div>
        <Link
          href={`/r/${restaurant.slug}`}
          target="_blank"
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-surface-100 px-4 text-sm font-medium text-surface-800 hover:bg-surface-200 transition"
        >
          View public site <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      <ClientBillingCard
        slug={restaurant.slug}
        restaurantName={restaurant.name}
        restaurantEmail={restaurant.email}
        hasOperatorStripe={!!operator.stripeSecretKey}
        initial={
          billing && {
            mode: (billing.mode as BillingMode) ?? null,
            amountCents: billing.amountCents,
            percentageBps: billing.percentageBps,
            description: billing.description,
            clientBillingEmail: billing.clientBillingEmail,
            clientBillingName: billing.clientBillingName,
            status: billing.status,
          }
        }
        invoices={invoices.map((i) => ({
          id: i.id,
          amountCents: i.amountCents,
          status: i.status,
          description: i.description,
          hostedUrl: i.hostedUrl,
          dueAt: i.dueAt?.toISOString() ?? null,
          paidAt: i.paidAt?.toISOString() ?? null,
          createdAt: i.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
