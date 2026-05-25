import { NextRequest, NextResponse } from "next/server";
import { updateOrderStatus } from "@/app/r/[slug]/admin/(panel)/actions";
import { ORDER_STATUSES } from "@/lib/order-status";

export const runtime = "nodejs";

/**
 * Dev-only convenience endpoint used by scripts/audit-sse.ts. Requires the
 * caller's session cookie (so requireRestaurantAdmin works just like
 * the real Server Action path).
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not available" }, { status: 404 });
  }
  const body = await req.json();
  if (!ORDER_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "bad status" }, { status: 400 });
  }
  try {
    const res = await updateOrderStatus({
      slug: body.slug,
      orderId: body.orderId,
      status: body.status,
    });
    return NextResponse.json(res);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ ok: false, error: msg }, { status: 403 });
  }
}
