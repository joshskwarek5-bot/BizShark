/**
 * Phase 13 audit — Business-type taxonomy, feature toggles, Inquiry inbox.
 *
 *  - 8 business types defined; each has defaultFeatures + meta
 *  - effectiveFeatures(type, null) falls back to type defaults
 *  - normalizeFeatures enforces requires + applicableTo + alwaysOn
 *  - Inquiry submission via public action lands in DB
 *  - Inquiry inbox page renders for the restaurant_admin
 *  - Cross-tenant: other restaurant_admin can't reach this restaurant's inbox
 *  - guessBusinessType maps common Place primaryTypes
 */
import { db } from "@/lib/db";
import {
  BUSINESS_TYPES,
  BUSINESS_TYPE_META,
  guessBusinessType,
} from "@/lib/business-types";
import {
  FEATURE_KEYS,
  FEATURE_META,
  effectiveFeatures,
  normalizeFeatures,
  parseEnabledFeatures,
  serializeFeatures,
} from "@/lib/features";
import { hashPassword } from "@/lib/auth";
import { submitInquiry } from "@/app/r/[slug]/(customer)/inquiry-actions";

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

interface CookieJar {
  cookies: Map<string, string>;
}
function newJar(): CookieJar {
  return { cookies: new Map() };
}
function captureCookies(jar: CookieJar, res: Response) {
  const setCookies = res.headers.getSetCookie?.() ?? [];
  for (const sc of setCookies) {
    const [pair] = sc.split(";");
    const [name, val] = pair.split("=");
    if (name && val !== undefined) jar.cookies.set(name.trim(), val.trim());
  }
}
function cookieHeader(jar: CookieJar): string {
  return [...jar.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}
function extractFields(html: string) {
  const refMatch = html.match(/name="(\$ACTION_REF_\d+)"/);
  if (!refMatch) return null;
  const suffix = refMatch[1].split("_").pop()!;
  const inputs = html.match(/<input[^/]*\/>/g) ?? [];
  const find = (re: RegExp) => inputs.find((i) => re.test(i));
  const decode = (s: string) => s.replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  const valueOf = (i?: string) => {
    if (!i) return "";
    const m = i.match(/value="([^"]*)"/);
    return m ? decode(m[1]) : "";
  };
  return {
    actionRef: refMatch[1],
    payloadName: `$ACTION_${suffix}:0`,
    payload: valueOf(find(new RegExp(`name="\\$ACTION_${suffix}:0"`))),
    boundName: `$ACTION_${suffix}:1`,
    bound: valueOf(find(new RegExp(`name="\\$ACTION_${suffix}:1"`))),
    keyName: "$ACTION_KEY",
    key: valueOf(find(/name="\$ACTION_KEY"/)),
  };
}
async function submitForm(
  jar: CookieJar,
  path: string,
  extras: Record<string, string>
) {
  const get = await fetch(`${BASE}${path}`, { headers: { Cookie: cookieHeader(jar) } });
  captureCookies(jar, get);
  const f = extractFields(await get.text());
  if (!f) throw new Error(`No form on ${path}`);
  const fd = new FormData();
  fd.append(f.actionRef, "");
  fd.append(f.payloadName, f.payload);
  if (f.bound) fd.append(f.boundName, f.bound);
  fd.append(f.keyName, f.key);
  for (const [k, v] of Object.entries(extras)) fd.append(k, v);
  const post = await fetch(`${BASE}${path}`, {
    method: "POST",
    body: fd,
    headers: { Cookie: cookieHeader(jar) },
    redirect: "manual",
  });
  captureCookies(jar, post);
  await post.body?.cancel();
  return { status: post.status, redirected: post.headers.get("location") ?? undefined };
}

async function main() {
  console.log("🧩 Business types + features + inquiries audit\n");

  // Cleanup
  await db.inquiry.deleteMany({
    where: { customerEmail: { startsWith: "audit-feat-" } },
  });
  await db.user.deleteMany({
    where: {
      email: {
        in: ["feat-owner-a@audit.local", "feat-owner-b@audit.local"],
      },
    },
  });
  await db.restaurant.deleteMany({
    where: { slug: { startsWith: "audit-feat-" } },
  });

  // ----------------------------------------------------------
  section("Phase A: business types + features taxonomy");
  if (BUSINESS_TYPES.length >= 8) pass(`${BUSINESS_TYPES.length} business types defined`);
  else fail("Need 8+ types", String(BUSINESS_TYPES.length));

  for (const t of BUSINESS_TYPES) {
    const meta = BUSINESS_TYPE_META[t];
    if (!meta || !meta.label || meta.defaultFeatures.length === 0) {
      fail(`type ${t} incomplete`);
    }
  }
  pass("All types have label + defaultFeatures");

  if (FEATURE_KEYS.length >= 9) pass(`${FEATURE_KEYS.length} features defined`);
  else fail("Need 9+ features");

  // Menu only for restaurants
  if (
    FEATURE_META.menu.applicableTo.length === 1 &&
    FEATURE_META.menu.applicableTo[0] === "restaurant"
  ) {
    pass("menu restricted to restaurant type");
  } else {
    fail("menu should be restaurant-only");
  }

  // online_ordering requires menu
  if (FEATURE_META.online_ordering.requires?.includes("menu")) {
    pass("online_ordering requires menu");
  } else {
    fail("online_ordering should require menu");
  }

  // hours is alwaysOn
  if (FEATURE_META.hours.alwaysOn) pass("hours is alwaysOn");
  else fail("hours should be alwaysOn");

  // ----------------------------------------------------------
  section("Phase B: feature normalization rules");
  // Drop inapplicable features
  const n1 = normalizeFeatures("trade_service", [
    "menu",
    "quote_request",
    "online_ordering",
  ]);
  if (!n1.includes("menu") && !n1.includes("online_ordering") && n1.includes("quote_request")) {
    pass("normalize drops menu/ordering for trade_service");
  } else {
    fail("normalize trade_service wrong", JSON.stringify(n1));
  }

  // Auto-enable required deps
  const n2 = normalizeFeatures("restaurant", ["online_ordering"]);
  if (n2.includes("menu") && n2.includes("online_ordering")) {
    pass("normalize auto-adds menu when ordering on");
  } else {
    fail("requires should auto-enable", JSON.stringify(n2));
  }

  // Always-on present
  const n3 = normalizeFeatures("restaurant", []);
  if (n3.includes("hours")) pass("normalize injects alwaysOn (hours)");
  else fail("alwaysOn missing", JSON.stringify(n3));

  // ----------------------------------------------------------
  section("Phase C: effectiveFeatures falls back to defaults");
  const def = effectiveFeatures("personal_service", null);
  if (def.has("appointment_request") && def.has("services_list")) {
    pass("personal_service defaults include appointment + services");
  } else {
    fail("personal_service defaults wrong", JSON.stringify(Array.from(def)));
  }
  const explicit = effectiveFeatures(
    "personal_service",
    serializeFeatures(["contact_form"])
  );
  if (explicit.size === 1 && explicit.has("contact_form")) {
    pass("explicit list overrides defaults");
  } else {
    fail("explicit override wrong", JSON.stringify(Array.from(explicit)));
  }

  // ----------------------------------------------------------
  section("Phase D: parseEnabledFeatures handles bad input");
  if (parseEnabledFeatures(null).size === 0) pass("null → empty set");
  if (parseEnabledFeatures("not-json").size === 0) pass("bad JSON → empty set");
  if (parseEnabledFeatures("[42]").size === 0) pass("non-string items → empty set");
  if (parseEnabledFeatures('["menu","nope","contact_form"]').size === 2)
    pass("filters unknown keys");
  else fail("filter check failed");

  // ----------------------------------------------------------
  section("Phase E: guessBusinessType mapping");
  const mappings: Array<[string, string]> = [
    ["restaurant", "restaurant"],
    ["cafe", "restaurant"],
    ["hair_salon", "personal_service"],
    ["barber_shop", "personal_service"],
    ["dental_clinic", "healthcare"],
    ["plumber", "trade_service"],
    ["gym", "fitness"],
    ["lawyer", "professional_service"],
    ["florist", "retail"],
    ["unknown_thing", "service_business"],
  ];
  for (const [input, expected] of mappings) {
    const got = guessBusinessType(input);
    if (got === expected) pass(`guess(${input}) → ${got}`);
    else fail(`guess(${input}) expected ${expected}, got ${got}`);
  }

  // ----------------------------------------------------------
  section("Phase F: Inquiry submission + scoping");
  // Make a trade_service restaurant + its admin
  const restA = await db.restaurant.create({
    data: {
      slug: "audit-feat-a-cafe",
      name: "Feature A HVAC",
      type: "trade_service",
      address: "1 X",
      phone: "(555) 000-0001",
      hours: "{}",
      enabledFeatures: serializeFeatures(["services_list", "quote_request", "hours"]),
      isActive: true,
    },
  });
  await db.user.create({
    data: {
      email: "feat-owner-a@audit.local",
      passwordHash: await hashPassword("feat123!"),
      role: "restaurant_admin",
      restaurantId: restA.id,
    },
  });

  // Submit a quote via the public action
  const inqRes = await submitInquiry({
    slug: restA.slug,
    kind: "quote",
    name: "Audit Customer",
    email: "audit-feat-test@example.com",
    phone: "(555) 999-0000",
    message: "Need an AC tune-up",
    serviceRequested: "AC repair",
    preferredDate: "",
    preferredTime: "",
    address: "123 Main St",
  });
  if (inqRes.ok) pass("submitInquiry quote → saved");
  else fail("inquiry submit failed", "error" in inqRes ? inqRes.error : "");

  // Public spam guard: no email AND no phone → rejected
  const inqBad = await submitInquiry({
    slug: restA.slug,
    kind: "contact",
    name: "No Contact",
    email: "",
    phone: "",
    message: "hi",
  });
  if (!inqBad.ok) pass("rejects missing contact info");
  else fail("should reject missing contact");

  const allInquiries = await db.inquiry.count({
    where: { restaurantId: restA.id },
  });
  if (allInquiries === 1) pass(`exactly 1 inquiry saved for restA (${allInquiries})`);
  else fail("inquiry count off", String(allInquiries));

  // ----------------------------------------------------------
  section("Phase G: inquiry inbox auth scoping");
  const jarA = newJar();
  await submitForm(jarA, `/r/${restA.slug}/admin/login`, {
    email: "feat-owner-a@audit.local",
    password: "feat123!",
  });
  const inboxRes = await fetch(`${BASE}/r/${restA.slug}/admin/inquiries`, {
    headers: { Cookie: cookieHeader(jarA) },
    redirect: "manual",
  });
  if (inboxRes.status === 200) {
    const html = await inboxRes.text();
    pass("Inquiry inbox 200 for restaurant_admin");
    if (html.includes("Inquiries")) pass("Inbox heading present");
    if (html.includes("Audit Customer")) pass("Submitted inquiry shows in inbox");
  } else {
    fail("inbox HTTP", String(inboxRes.status));
  }

  // Different restaurant_admin should NOT see this inbox
  const restB = await db.restaurant.create({
    data: {
      slug: "audit-feat-b-other",
      name: "Feature B Other",
      type: "personal_service",
      address: "2 Y",
      phone: "(555) 000-0002",
      hours: "{}",
      isActive: true,
    },
  });
  await db.user.create({
    data: {
      email: "feat-owner-b@audit.local",
      passwordHash: await hashPassword("feat123!"),
      role: "restaurant_admin",
      restaurantId: restB.id,
    },
  });
  const jarB = newJar();
  await submitForm(jarB, `/r/${restB.slug}/admin/login`, {
    email: "feat-owner-b@audit.local",
    password: "feat123!",
  });
  const xRes = await fetch(`${BASE}/r/${restA.slug}/admin/inquiries`, {
    headers: { Cookie: cookieHeader(jarB) },
    redirect: "manual",
  });
  await xRes.body?.cancel();
  if ([302, 307, 404].includes(xRes.status)) {
    pass(`cross-tenant inbox blocked (${xRes.status})`);
  } else {
    fail("cross-tenant inbox leaks", String(xRes.status));
  }

  // ----------------------------------------------------------
  section("Phase H: public site renders the right features");
  const publicA = await fetch(`${BASE}/r/${restA.slug}`, {
    redirect: "manual",
  });
  if (publicA.status === 200) {
    const html = await publicA.text();
    if (html.includes("Get a free quote")) pass("quote form rendered for trade_service");
    else fail("trade_service public missing quote form");
    if (!html.includes("Featured menu favorites") && !html.includes("View menu")) {
      pass("trade_service does NOT render menu");
    } else {
      fail("trade_service should not render menu");
    }
  } else {
    fail("public landing failed", String(publicA.status));
  }

  // ----------------------------------------------------------
  section("Phase I: cleanup");
  await db.inquiry.deleteMany({
    where: { restaurantId: { in: [restA.id, restB.id] } },
  });
  await db.user.deleteMany({
    where: {
      email: { in: ["feat-owner-a@audit.local", "feat-owner-b@audit.local"] },
    },
  });
  await db.restaurant.deleteMany({
    where: { slug: { startsWith: "audit-feat-" } },
  });
  pass("Test data removed");

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
