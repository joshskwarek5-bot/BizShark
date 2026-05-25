import { NextRequest, NextResponse } from "next/server";
import { placeOrder } from "@/app/r/[slug]/(customer)/checkout/actions";

export const runtime = "nodejs";

/**
 * Dev-only convenience endpoint used by scripts/audit-sse.ts.
 * Calls placeOrder inside the dev-server process so in-process events
 * fire correctly. Refuses to run when NODE_ENV === "production".
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not available" }, { status: 404 });
  }
  const body = await req.json();
  const res = await placeOrder({
    slug: body.slug,
    customerName: "SSE Audit",
    customerPhone: "(720) 555-0100",
    pickupTime: "ASAP",
    tipCents: 0,
    lines: [{ itemId: body.itemId, quantity: 1 }],
  });
  return NextResponse.json(res);
}
