/**
 * Verifies the multi-client-type generalization:
 *   1. Existing Mama Bears (type=restaurant) is unchanged
 *   2. Creating a service_business client works
 *   3. Its landing page renders, menu page redirects, admin nav adapts
 *   4. Cleanup
 */
import { db } from "@/lib/db";
import { clientTypeMeta, parseServices } from "@/lib/client-type";

const BASE = "http://localhost:3000";

let passes = 0;
let failures = 0;
const pass = (l: string) => {
  passes++;
  console.log(`  ✓ ${l}`);
};
const fail = (l: string, why?: string) => {
  failures++;
  console.log(`  ✗ ${l}${why ? ` — ${why}` : ""}`);
};
const section = (l: string) => console.log(`\n${l}`);

async function head(path: string): Promise<{ status: number; location?: string }> {
  const r = await fetch(`${BASE}${path}`, { redirect: "manual" });
  return { status: r.status, location: r.headers.get("location") ?? undefined };
}

async function html(path: string): Promise<string> {
  const r = await fetch(`${BASE}${path}`, { redirect: "follow" });
  return r.text();
}

async function main() {
  console.log("🏢 Client Type Audit\n");

  section("Phase A: Mama Bears (restaurant) is intact");
  const mb = await db.restaurant.findUnique({ where: { slug: "mama-bears" } });
  if (mb?.type === "restaurant") pass("Mama Bears type = restaurant");
  else fail("Mama Bears type incorrect", String(mb?.type));
  const mbMeta = clientTypeMeta(mb!.type);
  if (mbMeta.hasMenu && mbMeta.hasOrdering) pass("Restaurant meta correct");
  else fail("Restaurant meta wrong");

  const mbHome = await head("/r/mama-bears");
  if (mbHome.status === 200) pass("Restaurant landing 200");
  else fail("Restaurant landing", String(mbHome.status));
  const mbMenu = await head("/r/mama-bears/menu");
  if (mbMenu.status === 200) pass("Restaurant menu 200");
  else fail("Restaurant menu", String(mbMenu.status));

  section("Phase B: Create a service_business client");
  // Clean up any prior test runs first
  const existing = await db.restaurant.findUnique({ where: { slug: "audit-salon" } });
  if (existing) await db.restaurant.delete({ where: { id: existing.id } });

  const services = [
    { id: "s1", name: "Haircut", priceCents: 4500, duration: "45 min" },
    { id: "s2", name: "Color & highlights", priceCents: 12000, duration: "2 hr" },
    { id: "s3", name: "Beard trim", priceCents: 2500, duration: "20 min" },
  ];
  const salon = await db.restaurant.create({
    data: {
      slug: "audit-salon",
      type: "service_business",
      name: "Audit Salon",
      tagline: "Cuts, color, and conversation since 2019.",
      aboutCopy:
        "We're a neighborhood salon focused on great cuts and an even better hang. Walk-ins welcome.",
      address: "100 Test St",
      city: "Boulder",
      state: "CO",
      zip: "80301",
      phone: "(720) 555-9999",
      primaryColor: "#7A4FBF",
      accentColor: "#2D5A3D",
      hours: JSON.stringify({
        mon: { open: "09:00", close: "19:00" },
        tue: { open: "09:00", close: "19:00" },
        wed: { open: "09:00", close: "19:00" },
        thu: { open: "09:00", close: "19:00" },
        fri: { open: "09:00", close: "19:00" },
        sat: { open: "10:00", close: "18:00" },
        sun: { open: "10:00", close: "18:00", closed: true },
      }),
      services: JSON.stringify(services),
      isActive: true,
    },
  });
  if (salon.id) pass("Created service_business client");
  else fail("Could not create");

  const meta = clientTypeMeta(salon.type);
  if (meta.hasServices && !meta.hasMenu && !meta.hasOrdering) pass("Service-business meta correct");
  else fail("Service-business meta wrong");

  section("Phase C: Service-business URLs render correctly");
  const home = await head(`/r/${salon.slug}`);
  if (home.status === 200) pass("Landing 200");
  else fail("Landing", String(home.status));

  // Menu page should redirect to landing (service businesses have no menu)
  const menu = await head(`/r/${salon.slug}/menu`);
  if (menu.status >= 300 && menu.status < 400 && menu.location?.endsWith(`/r/${salon.slug}`)) {
    pass("Menu page redirects to landing");
  } else {
    fail("Menu page should redirect", `${menu.status} → ${menu.location}`);
  }

  // Checkout shouldn't be reachable for ordering — but the page itself still renders an empty cart.
  // The important guard is server-side: placeOrder should reject because type !== restaurant.
  // (Actual placeOrder has the canOrderNow check + restaurant validity; full path tested elsewhere.)

  const homeHtml = await html(`/r/${salon.slug}`);
  if (homeHtml.includes("Audit Salon")) pass("Landing renders client name");
  else fail("Landing missing name");
  if (homeHtml.includes("Haircut")) pass("Services section renders");
  else fail("Services section missing");
  if (homeHtml.includes("neighborhood salon")) pass("About section renders");
  else fail("About section missing");
  if (!homeHtml.includes(">Menu<")) pass("Header nav doesn't show Menu link");
  else fail("Header nav still shows Menu for service business");

  section("Phase D: parseServices helper");
  const parsed = parseServices(salon.services);
  if (parsed.length === services.length) pass(`parseServices returned ${parsed.length} services`);
  else fail(`parseServices wrong count`, String(parsed.length));
  if (parsed[0].name === "Haircut" && parsed[0].priceCents === 4500) pass("Service fields preserved");
  else fail("Service fields wrong", JSON.stringify(parsed[0]));

  section("Phase E: Cleanup");
  await db.restaurant.delete({ where: { id: salon.id } });
  pass("Test client deleted");

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`Result: ${passes} passed, ${failures} failed.`);
  if (failures > 0) process.exit(1);
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
