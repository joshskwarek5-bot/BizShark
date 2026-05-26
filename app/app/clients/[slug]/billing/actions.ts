"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/auth";
import {
  BILLING_MODES,
  ensureClientCustomer,
  mapInvoiceStatus,
  operatorStripe,
  type BillingMode,
} from "@/lib/client-billing";

async function ensureOwnedRestaurant(slug: string) {
  const auth = await requireOperator();
  if (!auth.authorized) throw new Error(auth.reason);
  const r = await db.restaurant.findUnique({ where: { slug } });
  if (!r) throw new Error("not_found");
  if (r.operatorId !== auth.operator.id) throw new Error("forbidden");
  return { operator: auth.operator, restaurant: r };
}

// ---------- Billing config ----------

const UpsertBillingSchema = z.object({
  slug: z.string(),
  mode: z.enum(BILLING_MODES),
  amountDollars: z.number().min(0).max(100_000).optional(),
  percentage: z.number().min(0).max(100).optional(),
  description: z.string().max(280).optional().nullable(),
  clientBillingEmail: z.string().email().max(120).optional().or(z.literal("")).nullable(),
  clientBillingName: z.string().max(120).optional().or(z.literal("")).nullable(),
});

export async function upsertClientBilling(input: z.infer<typeof UpsertBillingSchema>) {
  const data = UpsertBillingSchema.parse(input);
  const { operator, restaurant } = await ensureOwnedRestaurant(data.slug);

  // Validate per-mode required fields
  if (data.mode === "revenue_share") {
    if (data.percentage === undefined) {
      return { ok: false as const, error: "Percentage required for revenue share" };
    }
  } else {
    if (data.amountDollars === undefined || data.amountDollars <= 0) {
      return { ok: false as const, error: "Amount required" };
    }
  }

  const amountCents =
    data.amountDollars !== undefined ? Math.round(data.amountDollars * 100) : null;
  const percentageBps =
    data.percentage !== undefined ? Math.round(data.percentage * 100) : null;

  const existing = await db.clientBilling.findUnique({
    where: { restaurantId: restaurant.id },
  });

  if (existing) {
    await db.clientBilling.update({
      where: { id: existing.id },
      data: {
        mode: data.mode,
        amountCents,
        percentageBps,
        description: data.description ?? null,
        clientBillingEmail: data.clientBillingEmail || null,
        clientBillingName: data.clientBillingName || null,
      },
    });
  } else {
    await db.clientBilling.create({
      data: {
        restaurantId: restaurant.id,
        operatorId: operator.id,
        mode: data.mode,
        amountCents,
        percentageBps,
        description: data.description ?? null,
        clientBillingEmail: data.clientBillingEmail || null,
        clientBillingName: data.clientBillingName || null,
        status: "draft",
      },
    });
  }
  revalidatePath(`/app/clients/${data.slug}/billing`);
  return { ok: true as const };
}

// ---------- Invoice generation ----------

const CreateInvoiceSchema = z.object({
  slug: z.string(),
  amountDollars: z.number().min(0.5).max(100_000),
  description: z.string().max(280).optional(),
});

export async function createOneTimeInvoice(input: z.infer<typeof CreateInvoiceSchema>) {
  const data = CreateInvoiceSchema.parse(input);
  const { operator, restaurant } = await ensureOwnedRestaurant(data.slug);

  if (!operator.stripeSecretKey) {
    return {
      ok: false as const,
      error: "Add your Stripe secret key in Settings before sending invoices.",
    };
  }
  const billing = await db.clientBilling.findUnique({
    where: { restaurantId: restaurant.id },
  });
  if (!billing) {
    return {
      ok: false as const,
      error: "Configure billing for this client first.",
    };
  }

  let stripe: ReturnType<typeof operatorStripe>;
  try {
    stripe = operatorStripe(operator.stripeSecretKey);
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Bad Stripe key" };
  }

  const amountCents = Math.round(data.amountDollars * 100);

  try {
    const customerId = await ensureClientCustomer(stripe, billing, {
      name: restaurant.name,
      email: restaurant.email ?? null,
      phone: restaurant.phone ?? null,
    });
    if (!billing.stripeCustomerId) {
      await db.clientBilling.update({
        where: { id: billing.id },
        data: { stripeCustomerId: customerId },
      });
    }

    // 1) Create invoice item
    const description = data.description ?? `Website services for ${restaurant.name}`;
    await stripe.invoiceItems.create({
      customer: customerId,
      amount: amountCents,
      currency: "usd",
      description,
    });
    // 2) Create + finalize invoice (Stripe auto-pulls pending invoice items)
    const invoice = await stripe.invoices.create({
      customer: customerId,
      collection_method: "send_invoice",
      days_until_due: 14,
      description,
      metadata: {
        billingId: billing.id,
        restaurantId: restaurant.id,
        operatorId: operator.id,
      },
    });
    const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
    // 3) Send (Stripe emails the client)
    const sent = await stripe.invoices.sendInvoice(finalized.id);

    const local = await db.clientInvoice.create({
      data: {
        billingId: billing.id,
        restaurantId: restaurant.id,
        operatorId: operator.id,
        stripeInvoiceId: sent.id,
        hostedUrl: sent.hosted_invoice_url ?? null,
        status: mapInvoiceStatus(sent.status),
        amountCents,
        currency: "usd",
        description,
        dueAt: sent.due_date ? new Date(sent.due_date * 1000) : null,
      },
    });

    // Mark billing relationship as active now that something's been sent
    if (billing.status === "draft") {
      await db.clientBilling.update({
        where: { id: billing.id },
        data: { status: "active" },
      });
    }

    revalidatePath(`/app/clients/${data.slug}/billing`);
    return {
      ok: true as const,
      invoiceId: local.id,
      hostedUrl: sent.hosted_invoice_url ?? null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Stripe error";
    console.error("[createOneTimeInvoice]", e);
    return { ok: false as const, error: msg };
  }
}

/**
 * Pull live status for an invoice from Stripe and reconcile to the local row.
 * The operator can manually refresh; webhooks would be nice but operators'
 * own Stripe accounts don't have our webhook configured.
 */
export async function refreshInvoiceStatus(input: { invoiceLocalId: string }) {
  const { invoiceLocalId } = z.object({ invoiceLocalId: z.string() }).parse(input);
  const auth = await requireOperator();
  if (!auth.authorized) throw new Error(auth.reason);
  const inv = await db.clientInvoice.findUnique({ where: { id: invoiceLocalId } });
  if (!inv || inv.operatorId !== auth.operator.id) {
    return { ok: false as const, error: "Invoice not found" };
  }
  if (!inv.stripeInvoiceId || !auth.operator.stripeSecretKey) {
    return { ok: false as const, error: "No Stripe link" };
  }
  try {
    const stripe = operatorStripe(auth.operator.stripeSecretKey);
    const fresh = await stripe.invoices.retrieve(inv.stripeInvoiceId);
    const status = mapInvoiceStatus(fresh.status);
    await db.clientInvoice.update({
      where: { id: inv.id },
      data: {
        status,
        paidAt:
          status === "paid"
            ? fresh.status_transitions.paid_at
              ? new Date(fresh.status_transitions.paid_at * 1000)
              : new Date()
            : inv.paidAt,
        hostedUrl: fresh.hosted_invoice_url ?? inv.hostedUrl,
      },
    });
    revalidatePath(`/app/clients/${inv.restaurantId}/billing`);
    return { ok: true as const, status };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Refresh failed" };
  }
}
