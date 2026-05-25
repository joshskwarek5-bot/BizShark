import { NextRequest, NextResponse } from "next/server";
import { refreshStripeStatus } from "@/app/r/[slug]/admin/(panel)/stripe-actions";

export const runtime = "nodejs";

/**
 * Stripe redirects the user here after they finish (or partially finish)
 * Express onboarding. We refresh the account state and then send them back
 * to their admin Settings page.
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  try {
    await refreshStripeStatus(slug);
  } catch (e) {
    console.error("[stripe-connect-return]", e);
  }
  return NextResponse.redirect(
    new URL(`/r/${slug}/admin/settings?stripe=connected`, req.url)
  );
}
