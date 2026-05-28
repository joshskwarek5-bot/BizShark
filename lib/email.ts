import { Resend } from "resend";
import type { Order, OrderItem, Restaurant } from "@prisma/client";
import { formatMoney } from "./utils";
import { appBaseUrl } from "./stripe";

type OrderWithItems = Order & { items: OrderItem[] };

let cached: Resend | null = null;
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!cached) cached = new Resend(key);
  return cached;
}

function fromAddress(): string {
  return process.env.RESEND_FROM ?? "BizShark <onboarding@resend.dev>";
}

/**
 * Sends a transactional receipt to the customer. Designed to be best-effort:
 *  - Returns silently when RESEND_API_KEY is unset.
 *  - Returns silently when the order has no customer email.
 *  - Catches Resend API errors and logs them. NEVER throws — payment flows
 *    must not fail because email failed.
 */
export async function sendOrderReceipt(
  order: OrderWithItems,
  restaurant: Restaurant
): Promise<{ ok: boolean; skipped?: string; error?: string }> {
  const to = order.customerEmail?.trim();
  if (!to) return { ok: false, skipped: "no customer email" };

  const resend = getResend();
  if (!resend) {
    console.warn(
      "[email] RESEND_API_KEY not set — skipping receipt for order " + order.id
    );
    return { ok: false, skipped: "RESEND_API_KEY not set" };
  }

  const orderUrl = `${appBaseUrl()}/r/${restaurant.slug}/order/${order.id}`;
  const subject = `Order #${order.orderNumber} confirmed — ${restaurant.name}`;
  const text = renderText(order, restaurant, orderUrl);
  const html = renderHtml(order, restaurant, orderUrl);

  try {
    const { error } = await resend.emails.send({
      from: fromAddress(),
      to,
      subject,
      text,
      html,
      replyTo: restaurant.email ?? undefined,
    });
    if (error) {
      console.error("[email] resend send failed", error);
      return { ok: false, error: String(error) };
    }
    return { ok: true };
  } catch (e) {
    console.error("[email] resend threw", e);
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

// -------- Renderers --------

function renderText(
  order: OrderWithItems,
  restaurant: Restaurant,
  orderUrl: string
): string {
  const lines: string[] = [];
  lines.push(`Thanks, ${order.customerName.split(" ")[0]}!`);
  lines.push("");
  lines.push(`Your order #${order.orderNumber} at ${restaurant.name} is confirmed.`);
  lines.push("");
  lines.push("ORDER");
  lines.push("-----");
  for (const it of order.items) {
    lines.push(
      `  ${it.quantity}× ${it.name}  ${formatMoney(it.priceCents * it.quantity)}`
    );
    if (it.notes) lines.push(`     Note: ${it.notes}`);
  }
  lines.push("");
  lines.push(`Subtotal: ${formatMoney(order.subtotalCents)}`);
  lines.push(`Tax:      ${formatMoney(order.taxCents)}`);
  if (order.tipCents > 0) lines.push(`Tip:      ${formatMoney(order.tipCents)}`);
  lines.push(`Total:    ${formatMoney(order.totalCents)}`);
  lines.push("");
  lines.push("PICKUP");
  lines.push("------");
  lines.push(`When:  ${order.pickupTime}`);
  lines.push(
    `Where: ${[restaurant.address, restaurant.city, restaurant.state]
      .filter(Boolean)
      .join(", ")}`
  );
  lines.push(`Phone: ${restaurant.phone}`);
  lines.push("");
  if (order.notes) {
    lines.push("Your notes:");
    lines.push(order.notes);
    lines.push("");
  }
  lines.push(`Track your order: ${orderUrl}`);
  lines.push("");
  lines.push(`— ${restaurant.name}`);
  return lines.join("\n");
}

function renderHtml(
  order: OrderWithItems,
  restaurant: Restaurant,
  orderUrl: string
): string {
  const items = order.items
    .map(
      (it) => `
        <tr>
          <td style="padding:10px 0;color:#27211a;font-family:system-ui,-apple-system,sans-serif;">
            <strong>${it.quantity}× ${escapeHtml(it.name)}</strong>
            ${it.notes ? `<div style="color:#7a6e60;font-size:12px;margin-top:2px;">Note: ${escapeHtml(it.notes)}</div>` : ""}
          </td>
          <td align="right" style="padding:10px 0;color:#27211a;font-family:ui-monospace,monospace;white-space:nowrap;">
            ${formatMoney(it.priceCents * it.quantity)}
          </td>
        </tr>`
    )
    .join("");

  const tipRow =
    order.tipCents > 0
      ? `<tr>
           <td style="padding:4px 0;color:#574d40;font-family:system-ui,sans-serif;font-size:14px;">Tip</td>
           <td align="right" style="padding:4px 0;color:#574d40;font-family:ui-monospace,monospace;font-size:14px;">${formatMoney(order.tipCents)}</td>
         </tr>`
      : "";

  const notesBlock = order.notes
    ? `<div style="margin-top:16px;padding:12px 14px;background:#fff8eb;border-radius:10px;font-size:13px;color:#7c5b1a;font-family:system-ui,sans-serif;">
         <strong>Your notes:</strong><br/>${escapeHtml(order.notes)}
       </div>`
    : "";

  return `<!doctype html>
<html><body style="margin:0;background:#fbf8f3;padding:24px 12px;font-family:system-ui,-apple-system,sans-serif;color:#27211a;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;margin:0 auto;">
    <tr><td>
      <div style="text-align:center;padding:8px 0 20px;">
        <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#9c8c79;">Order confirmed</div>
        <div style="font-size:28px;font-weight:600;margin-top:4px;">Order #${order.orderNumber}</div>
        <div style="color:#7a6e60;margin-top:4px;">${escapeHtml(restaurant.name)}</div>
      </div>

      <div style="background:#ffffff;border-radius:18px;padding:24px;border:1px solid #ece4d8;">
        <p style="margin:0 0 14px 0;color:#27211a;">
          Thanks, ${escapeHtml(order.customerName.split(" ")[0])} — we&apos;ve got your order.
        </p>
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
          ${items}
        </table>
        <hr style="border:none;border-top:1px solid #ece4d8;margin:16px 0;" />
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="padding:4px 0;color:#574d40;font-family:system-ui,sans-serif;font-size:14px;">Subtotal</td>
            <td align="right" style="padding:4px 0;color:#574d40;font-family:ui-monospace,monospace;font-size:14px;">${formatMoney(order.subtotalCents)}</td>
          </tr>
          <tr>
            <td style="padding:4px 0;color:#574d40;font-family:system-ui,sans-serif;font-size:14px;">Tax</td>
            <td align="right" style="padding:4px 0;color:#574d40;font-family:ui-monospace,monospace;font-size:14px;">${formatMoney(order.taxCents)}</td>
          </tr>
          ${tipRow}
          <tr>
            <td style="padding:10px 0 0 0;color:#27211a;font-family:system-ui,sans-serif;font-weight:600;border-top:1px solid #ece4d8;">Total</td>
            <td align="right" style="padding:10px 0 0 0;color:#27211a;font-family:ui-monospace,monospace;font-weight:600;border-top:1px solid #ece4d8;">${formatMoney(order.totalCents)}</td>
          </tr>
        </table>

        ${notesBlock}

        <div style="margin-top:24px;padding-top:20px;border-top:1px solid #ece4d8;">
          <div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#9c8c79;">Pickup</div>
          <div style="margin-top:6px;font-weight:600;">${escapeHtml(order.pickupTime)}</div>
          <div style="margin-top:10px;font-size:14px;color:#574d40;line-height:1.45;">
            ${escapeHtml(restaurant.address)}<br/>
            ${escapeHtml([restaurant.city, restaurant.state].filter(Boolean).join(", "))}<br/>
            <a href="tel:${restaurant.phone.replace(/[^\d+]/g, "")}" style="color:#27211a;">${escapeHtml(restaurant.phone)}</a>
          </div>
        </div>

        <div style="margin-top:24px;text-align:center;">
          <a href="${orderUrl}" style="display:inline-block;background:#27211a;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:500;">
            View order status →
          </a>
        </div>
      </div>

      <div style="text-align:center;margin-top:18px;font-size:12px;color:#9c8c79;">
        Thanks for ordering from ${escapeHtml(restaurant.name)}.
      </div>
    </td></tr>
  </table>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
