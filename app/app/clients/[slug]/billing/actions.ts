"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/auth";
import {
  BILLING_MODES,
  ensureClientCustomer,
  ensureMonthlyPrice,
  mapInvoiceStatus,
  operatorStripe,
} from "@/lib/client-billing";

async function ensureOwnedRestaurant(slug: string) {
  const auth = await requireOperator();
  if (!auth.authorized) throw new Error(auth.reason);
  const r = await db.restaurant.findUnique({ where: { slug } });
  if (!r) throw new Error("not_found");
  if (r.operatorId !== auth.operator.id) throw new Error("forbidden");
  return { operator: auth.operator, restaurant: r };
}

async function originFromHeaders(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
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

// ---------- Invoice generation (one-time + ad-hoc charges) ----------

const CreateInvoiceSchema = z.object({
  slug: z.string(),
  amountDollars: z.number().min(0.5).max(100_000),
  description: z.string().max(280).optional(),
  // When false, Stripe finalizes the invoice but does NOT send email.
  // Operator can still share the hosted URL manually.
  sendEmail: z.boolean().default(true),
});

/**
 * Create + finalize a Stripe Invoice for an ad-hoc / one-time charge.
 * Always returns the hosted URL — operator can share it manually whether or
 * not Stripe also emailed it.
 *
 * Will lazily create a draft ClientBilling row in `one_time` mode if none
 * exists yet, so the operator can charge first and configure later.
 */
export async function createOneTimeInvoice(input: z.infer<typeof CreateInvoiceSchema>) {
  const data = CreateInvoiceSchema.parse(input);
  const { operator, restaurant } = await ensureOwnedRestaurant(data.slug);

  if (!operator.stripeSecretKey) {
    return {
      ok: false as const,
      error: "Add your Stripe secret key in Settings before sending invoices.",
    };
  }

  let billing = await db.clientBilling.findUnique({
    where: { restaurantId: restaurant.id },
  });
  if (!billing) {
    billing = await db.clientBilling.create({
      data: {
        restaurantId: restaurant.id,
        operatorId: operator.id,
        mode: "one_time",
        amountCents: Math.round(data.amountDollars * 100),
        description: data.description ?? null,
        clientBillingEmail: restaurant.email ?? null,
        clientBillingName: restaurant.name,
        status: "draft",
      },
    });
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

    const description = data.description ?? `Website services for ${restaurant.name}`;
    await stripe.invoiceItems.create({
      customer: customerId,
      amount: amountCents,
      currency: "usd",
      description,
    });
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
    const final = data.sendEmail
      ? await stripe.invoices.sendInvoice(finalized.id)
      : finalized;

    const local = await db.clientInvoice.create({
      data: {
        billingId: billing.id,
        restaurantId: restaurant.id,
        operatorId: operator.id,
        stripeInvoiceId: final.id,
        hostedUrl: final.hosted_invoice_url ?? null,
        status: mapInvoiceStatus(final.status),
        amountCents,
        currency: "usd",
        description,
        dueAt: final.due_date ? new Date(final.due_date * 1000) : null,
      },
    });

    if (billing.status === "draft") {
      await db.clientBilling.update({
        where: { id: billing.id },
        data: { status: "active" },
      });
    }

    revalidatePath(`/app/clients/${data.slug}/billing`);
    revalidatePath(`/r/${data.slug}/admin/billing`);
    revalidatePath(`/r/${data.slug}/admin`);
    return {
      ok: true as const,
      invoiceId: local.id,
      hostedUrl: final.hosted_invoice_url ?? null,
      emailed: data.sendEmail,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Stripe error";
    console.error("[createOneTimeInvoice]", e);
    return { ok: false as const, error: msg };
  }
}

// ---------- Monthly subscription (Checkout Session) ----------

const StartSubscriptionSchema = z.object({
  slug: z.string(),
  // Optional override; defaults to the saved monthly amount on ClientBilling
  amountDollars: z.number().min(1).max(100_000).optional(),
});

/**
 * Create (or reuse) a recurring Stripe Price for this client and open a
 * Stripe Checkout Session in subscription mode. Returns the URL — the
 * operator shares it with the client; the client enters a card and the
 * sub starts immediately, billing monthly thereafter.
 */
export async function startMonthlySubscription(
  input: z.infer<typeof StartSubscriptionSchema>
) {
  const data = StartSubscriptionSchema.parse(input);
  const { operator, restaurant } = await ensureOwnedRestaurant(data.slug);

  if (!operator.stripeSecretKey) {
    return {
      ok: false as const,
      error: "Add your Stripe secret key in Settings before starting subscriptions.",
    };
  }

  const billing = await db.clientBilling.findUnique({
    where: { restaurantId: restaurant.id },
  });
  if (!billing) {
    return {
      ok: false as const,
      error: "Configure monthly billing first (amount + description).",
    };
  }
  const amountCents =
    data.amountDollars !== undefined
      ? Math.round(data.amountDollars * 100)
      : billing.amountCents;
  if (!amountCents || amountCents < 50) {
    return { ok: false as const, error: "Monthly amount must be at least $0.50." };
  }
  if (billing.stripeSubscriptionId) {
    return {
      ok: false as const,
      error: "A subscription is already active. Use Refresh to sync its status.",
    };
  }

  let stripe: ReturnType<typeof operatorStripe>;
  try {
    stripe = operatorStripe(operator.stripeSecretKey);
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Bad Stripe key" };
  }

  try {
    const customerId = await ensureClientCustomer(stripe, billing, {
      name: restaurant.name,
      email: restaurant.email ?? null,
      phone: restaurant.phone ?? null,
    });
    const priceId = await ensureMonthlyPrice(
      stripe,
      billing,
      amountCents,
      billing.description ?? `Monthly website services — ${restaurant.name}`
    );
    const origin = await originFromHeaders();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/r/${restaurant.slug}/admin/billing?subscribed=1`,
      cancel_url: `${origin}/r/${restaurant.slug}/admin/billing?subscribed=0`,
      subscription_data: {
        metadata: {
          billingId: billing.id,
          restaurantId: restaurant.id,
          operatorId: operator.id,
        },
      },
      metadata: {
        billingId: billing.id,
        restaurantId: restaurant.id,
        operatorId: operator.id,
      },
    });

    await db.clientBilling.update({
      where: { id: billing.id },
      data: {
        stripeCustomerId: customerId,
        stripePriceId: priceId,
        pendingCheckoutUrl: session.url ?? null,
        amountCents,
        status: billing.status === "draft" ? "active" : billing.status,
      },
    });

    revalidatePath(`/app/clients/${data.slug}/billing`);
    revalidatePath(`/r/${data.slug}/admin/billing`);
    return { ok: true as const, url: session.url ?? null };
  } catch (e) {
    console.error("[startMonthlySubscription]", e);
    return { ok: false as const, error: e instanceof Error ? e.message : "Stripe error" };
  }
}

// ---------- Sync from Stripe ----------

const SyncSchema = z.object({ slug: z.string() });

/**
 * Pull the latest state from Stripe — subscription status + every invoice
 * we know about — and reconcile into our DB. Used by both the operator
 * AND the client-facing billing page (it calls a client-scoped variant).
 *
 * For monthly: if a Checkout Session has completed we'll discover the
 * subscription via the customer's subscriptions list and store it.
 */
export async function syncBillingFromStripe(input: z.infer<typeof SyncSchema>) {
  const { slug } = SyncSchema.parse(input);
  const { operator, restaurant } = await ensureOwnedRestaurant(slug);
  return await syncBillingForRestaurant(restaurant.id, operator.stripeSecretKey, slug);
}

/**
 * Same as syncBillingFromStripe but bypasses the operator-auth gate so the
 * restaurant_admin can press their own Refresh button. Looks up the
 * operator via the restaurant relation.
 */
export async function syncBillingForRestaurant(
  restaurantId: string,
  operatorSecretKeyOverride: string | null | undefined,
  slugForRevalidate: string
) {
  const billing = await db.clientBilling.findUnique({
    where: { restaurantId },
    include: { operator: true },
  });
  if (!billing) return { ok: true as const, updatedInvoices: 0, subscriptionStatus: null };
  const secretKey = operatorSecretKeyOverride ?? billing.operator.stripeSecretKey;
  if (!secretKey || !billing.stripeCustomerId) {
    return { ok: true as const, updatedInvoices: 0, subscriptionStatus: null };
  }

  let stripe: ReturnType<typeof operatorStripe>;
  try {
    stripe = operatorStripe(secretKey);
  } catch {
    return { ok: false as const, error: "Bad Stripe key" };
  }

  let updated = 0;

  try {
    // 1) Reconcile every known local invoice with Stripe
    const local = await db.clientInvoice.findMany({
      where: { restaurantId, stripeInvoiceId: { not: null } },
    });
    for (const li of local) {
      try {
        const fresh = await stripe.invoices.retrieve(li.stripeInvoiceId!);
        const status = mapInvoiceStatus(fresh.status);
        const paidAt =
          status === "paid"
            ? fresh.status_transitions.paid_at
              ? new Date(fresh.status_transitions.paid_at * 1000)
              : new Date()
            : li.paidAt;
        if (
          status !== li.status ||
          (paidAt && (!li.paidAt || paidAt.getTime() !== li.paidAt.getTime())) ||
          (fresh.hosted_invoice_url ?? null) !== li.hostedUrl
        ) {
          await db.clientInvoice.update({
            where: { id: li.id },
            data: {
              status,
              paidAt,
              hostedUrl: fresh.hosted_invoice_url ?? li.hostedUrl,
            },
          });
          updated++;
        }
      } catch {
        /* skip — invoice may have been deleted on Stripe */
      }
    }

    // 2) If we don't yet have a subscription on file, look one up
    if (!billing.stripeSubscriptionId) {
      const subs = await stripe.subscriptions.list({
        customer: billing.stripeCustomerId,
        status: "all",
        limit: 5,
      });
      const active = subs.data.find(
        (s) => s.status === "active" || s.status === "trialing" || s.status === "past_due"
      );
      if (active) {
        await db.clientBilling.update({
          where: { id: billing.id },
          data: {
            stripeSubscriptionId: active.id,
            pendingCheckoutUrl: null,
            status: "active",
          },
        });
      }
    } else {
      // Refresh the existing subscription's status
      try {
        const sub = await stripe.subscriptions.retrieve(billing.stripeSubscriptionId);
        let newStatus: string = billing.status;
        if (sub.status === "canceled") newStatus = "canceled";
        else if (sub.status === "past_due") newStatus = "active"; // still owed; mark distinct?
        else if (sub.status === "active" || sub.status === "trialing") newStatus = "active";
        if (newStatus !== billing.status) {
          await db.clientBilling.update({
            where: { id: billing.id },
            data: { status: newStatus },
          });
        }
      } catch {
        /* sub might have been deleted */
      }
    }

    // 3) Pull invoices for this customer that we haven't seen yet
    const remote = await stripe.invoices.list({
      customer: billing.stripeCustomerId,
      limit: 50,
    });
    for (const inv of remote.data) {
      const exists = local.find((l) => l.stripeInvoiceId === inv.id);
      if (exists) continue;
      await db.clientInvoice.create({
        data: {
          billingId: billing.id,
          restaurantId,
          operatorId: billing.operatorId,
          stripeInvoiceId: inv.id,
          hostedUrl: inv.hosted_invoice_url ?? null,
          status: mapInvoiceStatus(inv.status),
          amountCents: inv.amount_due ?? inv.amount_paid ?? 0,
          currency: inv.currency ?? "usd",
          description: inv.description ?? null,
          dueAt: inv.due_date ? new Date(inv.due_date * 1000) : null,
          paidAt: inv.status_transitions.paid_at
            ? new Date(inv.status_transitions.paid_at * 1000)
            : null,
        },
      });
      updated++;
    }
  } catch (e) {
    console.error("[syncBillingForRestaurant]", e);
    return { ok: false as const, error: e instanceof Error ? e.message : "Sync failed" };
  }

  revalidatePath(`/app/clients/${slugForRevalidate}/billing`);
  revalidatePath(`/r/${slugForRevalidate}/admin/billing`);
  revalidatePath(`/r/${slugForRevalidate}/admin`);
  return { ok: true as const, updatedInvoices: updated };
}

/**
 * Single-invoice refresh — kept for the in-row Refresh button.
 */
export async function refreshInvoiceStatus(input: { invoiceLocalId: string }) {
  const { invoiceLocalId } = z.object({ invoiceLocalId: z.string() }).parse(input);
  const auth = await requireOperator();
  if (!auth.authorized) throw new Error(auth.reason);
  const inv = await db.clientInvoice.findUnique({
    where: { id: invoiceLocalId },
    include: { restaurant: true },
  });
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
    revalidatePath(`/app/clients/${inv.restaurant.slug}/billing`);
    revalidatePath(`/r/${inv.restaurant.slug}/admin/billing`);
    return { ok: true as const, status };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Refresh failed" };
  }
}

// ---------- Cancel subscription ----------

const CancelSubSchema = z.object({ slug: z.string() });

export async function cancelClientSubscription(input: z.infer<typeof CancelSubSchema>) {
  const { slug } = CancelSubSchema.parse(input);
  const { operator, restaurant } = await ensureOwnedRestaurant(slug);
  if (!operator.stripeSecretKey) {
    return { ok: false as const, error: "Add your Stripe secret key first." };
  }
  const billing = await db.clientBilling.findUnique({
    where: { restaurantId: restaurant.id },
  });
  if (!billing?.stripeSubscriptionId) {
    return { ok: false as const, error: "No active subscription." };
  }
  try {
    const stripe = operatorStripe(operator.stripeSecretKey);
    await stripe.subscriptions.cancel(billing.stripeSubscriptionId);
    await db.clientBilling.update({
      where: { id: billing.id },
      data: { status: "canceled", stripeSubscriptionId: null },
    });
    revalidatePath(`/app/clients/${slug}/billing`);
    revalidatePath(`/r/${slug}/admin/billing`);
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Cancel failed" };
  }
}
