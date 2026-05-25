/**
 * End-to-end audit for the operator tier (Phase 1).
 *
 * What this proves:
 *  - signup creates Operator + User atomically and sets the session
 *  - /login routes each role to the right dashboard (operator/super/restaurant)
 *  - operator's /app is reachable; non-operators are bounced
 *  - operator A cannot access operator B's clients (via /r/<slug>/admin)
 *  - operator A's client list shows ONLY their clients
 *  - super_admin can still access any operator's client admin
 *  - existing restaurant_admin (Mama Bears) still works through the same
 *    requireRestaurantAdmin gate (no regression)
 *  - existing Mama Bears customer pages still render
 *
 * Requires the dev server on http://localhost:3000.
 */
import { db } from "@/lib/db";

const BASE = "http://localhost:3000";

let passes = 0;
let failures = 0;
const pass = (l: string) => { passes++; console.log(`  ✓ ${l}`); };
const fail = (l: string, why?: string) => {
  failures++;
  console.log(`  ✗ ${l}${why ? ` — ${why}` : ""}`);
};
const section = (l: string) => console.log(`\n${l}`);

// ---------- HTTP helpers (mirrors audit-http-auth.ts) ----------
interface CookieJar { cookies: Map<string, string>; }
function newJar(): CookieJar { return { cookies: new Map() }; }
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
  extraFields: Record<string, string>
): Promise<{ status: number; redirected?: string; html?: string }> {
  const get = await fetch(`${BASE}${path}`, { headers: { Cookie: cookieHeader(jar) } });
  captureCookies(jar, get);
  const html = await get.text();
  const f = extractFields(html);
  if (!f) throw new Error(`Could not parse form on ${path}`);
  const fd = new FormData();
  fd.append(f.actionRef, "");
  fd.append(f.payloadName, f.payload);
  if (f.bound) fd.append(f.boundName, f.bound);
  fd.append(f.keyName, f.key);
  for (const [k, v] of Object.entries(extraFields)) fd.append(k, v);
  const post = await fetch(`${BASE}${path}`, {
    method: "POST",
    body: fd,
    headers: { Cookie: cookieHeader(jar) },
    redirect: "manual",
  });
  captureCookies(jar, post);
  await post.body?.cancel();
  return {
    status: post.status,
    redirected: post.headers.get("location") ?? undefined,
  };
}

async function checkPage(
  jar: CookieJar,
  path: string
): Promise<{ status: number; location?: string }> {
  const r = await fetch(`${BASE}${path}`, {
    headers: { Cookie: cookieHeader(jar) },
    redirect: "manual",
  });
  await r.body?.cancel();
  return { status: r.status, location: r.headers.get("location") ?? undefined };
}

// ---------- Main ----------
async function main() {
  console.log("🛡️  Operator Isolation Audit\n");

  // Clean up any prior test artifacts
  await db.user.deleteMany({
    where: { email: { in: ["op-a-test@platform.local", "op-b-test@platform.local"] } },
  });
  await db.restaurant.deleteMany({
    where: { slug: { in: ["op-a-cafe", "op-b-cafe"] } },
  });
  await db.operator.deleteMany({
    where: { email: { in: ["op-a-test@platform.local", "op-b-test@platform.local"] } },
  });

  // =========================================================================
  section("Phase A: existing roles still route correctly via /login");

  // super_admin
  {
    const jar = newJar();
    const r = await submitForm(jar, "/login", {
      email: "josh@platform.local",
      password: "super123!",
    });
    if (r.status >= 300 && r.status < 400 && r.redirected === "/platform")
      pass(`super_admin → ${r.redirected} (${r.status})`);
    else fail(`super_admin route`, `${r.status} → ${r.redirected}`);

    const plat = await checkPage(jar, "/platform");
    if (plat.status === 200) pass("super_admin can reach /platform");
    else fail("super_admin /platform", String(plat.status));

    const app = await checkPage(jar, "/app");
    if (app.status >= 300 && app.status < 400 && app.location?.endsWith("/login"))
      pass("super_admin blocked from /app (redirected to /login)");
    else fail("super_admin /app should redirect", `${app.status} → ${app.location}`);
  }

  // restaurant_admin
  {
    const jar = newJar();
    const r = await submitForm(jar, "/login", {
      email: "owner@mamabears.local",
      password: "mama123!",
    });
    if (r.status >= 300 && r.status < 400 && r.redirected === "/r/mama-bears/admin")
      pass(`restaurant_admin → ${r.redirected} (${r.status})`);
    else fail("restaurant_admin route", `${r.status} → ${r.redirected}`);

    const adm = await checkPage(jar, "/r/mama-bears/admin");
    if (adm.status === 200) pass("restaurant_admin can reach their admin");
    else fail("restaurant_admin admin not reachable", String(adm.status));

    const app = await checkPage(jar, "/app");
    if (app.status >= 300 && app.status < 400 && app.location?.endsWith("/login"))
      pass("restaurant_admin blocked from /app");
    else fail("restaurant_admin /app should redirect", `${app.status}`);

    const plat = await checkPage(jar, "/platform");
    if (plat.status >= 300 && plat.status < 400)
      pass("restaurant_admin blocked from /platform");
    else fail("restaurant_admin /platform should redirect", String(plat.status));
  }

  // existing operator (agency@platform.local seeded)
  {
    const jar = newJar();
    const r = await submitForm(jar, "/login", {
      email: "agency@platform.local",
      password: "operator123!",
    });
    if (r.status >= 300 && r.status < 400 && r.redirected === "/app")
      pass(`operator → ${r.redirected} (${r.status})`);
    else fail("operator route", `${r.status} → ${r.redirected}`);

    const app = await checkPage(jar, "/app");
    if (app.status === 200) pass("operator can reach /app");
    else fail("operator /app", String(app.status));

    const clients = await checkPage(jar, "/app/clients");
    if (clients.status === 200) pass("operator can reach /app/clients");
    else fail("operator /app/clients", String(clients.status));

    const plat = await checkPage(jar, "/platform");
    if (plat.status >= 300 && plat.status < 400)
      pass("operator blocked from /platform");
    else fail("operator /platform should redirect", String(plat.status));

    // bootstrap operator owns Mama Bears, so they CAN reach its admin
    const mb = await checkPage(jar, "/r/mama-bears/admin");
    if (mb.status === 200) pass("operator who owns Mama Bears can reach its admin");
    else fail("operator → owned restaurant admin", String(mb.status));
  }

  // =========================================================================
  section("Phase B: signup creates a new operator + auto-logs in");
  {
    const jar = newJar();
    const r = await submitForm(jar, "/signup", {
      name: "Op A Tester",
      email: "op-a-test@platform.local",
      password: "opA12345!",
      businessName: "Op A Studio",
      areaCity: "Denver",
      areaState: "CO",
    });
    if (r.status >= 300 && r.status < 400 && r.redirected === "/app") {
      pass("Signup redirected to /app");
    } else {
      fail("Signup redirect", `${r.status} → ${r.redirected}`);
    }

    const opA = await db.operator.findUnique({
      where: { email: "op-a-test@platform.local" },
    });
    if (opA) pass(`Operator row created (${opA.id})`);
    else fail("Operator row missing after signup");

    const userA = await db.user.findUnique({
      where: { email: "op-a-test@platform.local" },
    });
    if (userA?.role === "operator" && userA.operatorId === opA?.id)
      pass("User row created with role=operator + correct operatorId");
    else fail("User row wrong", JSON.stringify(userA));

    const app = await checkPage(jar, "/app");
    if (app.status === 200) pass("New operator session reaches /app");
    else fail("Post-signup /app not 200", String(app.status));

    // Duplicate email is rejected
    const dup = await submitForm(newJar(), "/signup", {
      name: "Dupe",
      email: "op-a-test@platform.local",
      password: "another12!",
    });
    if (dup.status === 200) pass("Duplicate-email signup re-renders form (no redirect)");
    else fail("Duplicate signup should not redirect", String(dup.status));
  }

  // =========================================================================
  section("Phase C: signup operator B, verify cross-operator isolation");
  let opB_jar: CookieJar = newJar();
  let opB_id = "";
  {
    const r = await submitForm(opB_jar, "/signup", {
      name: "Op B Tester",
      email: "op-b-test@platform.local",
      password: "opB12345!",
      businessName: "Op B Studio",
    });
    if (r.status >= 300 && r.status < 400) pass("Operator B signed up");
    else fail("Operator B signup", String(r.status));

    const opB = await db.operator.findUnique({
      where: { email: "op-b-test@platform.local" },
    });
    if (opB) {
      pass("Operator B row exists");
      opB_id = opB.id;
    } else fail("Operator B missing");

    // Operator B should NOT be able to reach Mama Bears admin (owned by Josh's agency op)
    const mb = await checkPage(opB_jar, "/r/mama-bears/admin");
    if (mb.status >= 300 && mb.status < 400) {
      pass(`Operator B blocked from Mama Bears admin (${mb.status})`);
    } else {
      fail("Operator B should NOT access Mama Bears admin", String(mb.status));
    }
  }

  // =========================================================================
  section("Phase D: each operator's client list is scoped");
  {
    // Seed: give Operator B a fake restaurant
    const bRestaurant = await db.restaurant.create({
      data: {
        slug: "op-b-cafe",
        name: "Op B Cafe",
        address: "1 B St",
        phone: "(555) 000-0000",
        hours: "{}",
        operatorId: opB_id,
        isActive: true,
      },
    });

    // Operator B's /app/clients shows Op B Cafe
    const list = await fetch(`${BASE}/app/clients`, {
      headers: { Cookie: cookieHeader(opB_jar) },
      redirect: "manual",
    });
    const html = await list.text();
    if (html.includes("Op B Cafe")) pass("Operator B sees their own restaurant in /app/clients");
    else fail("Operator B missing their restaurant in list");
    if (!html.includes("Mama Bears Cafe"))
      pass("Operator B does NOT see Mama Bears in their list");
    else fail("Operator B leaked Mama Bears into their list");

    // Operator A (the seeded agency@platform.local) should NOT see Op B Cafe
    const opAJar = newJar();
    await submitForm(opAJar, "/login", {
      email: "agency@platform.local",
      password: "operator123!",
    });
    const aList = await fetch(`${BASE}/app/clients`, {
      headers: { Cookie: cookieHeader(opAJar) },
      redirect: "manual",
    });
    const aHtml = await aList.text();
    if (aHtml.includes("Mama Bears Cafe"))
      pass("Operator A (Josh's agency) sees their Mama Bears");
    else fail("Operator A missing Mama Bears");
    if (!aHtml.includes("Op B Cafe"))
      pass("Operator A does NOT see Op B Cafe");
    else fail("Operator A leaked Op B Cafe");

    // Operator B trying to open Op B Cafe admin → ok
    const bAdmin = await checkPage(opB_jar, `/r/${bRestaurant.slug}/admin`);
    if (bAdmin.status === 200) pass("Operator B can access their own restaurant admin");
    else fail("Operator B own admin", String(bAdmin.status));

    // Operator A trying to access Op B Cafe → forbidden (redirected)
    const aOnB = await checkPage(opAJar, `/r/${bRestaurant.slug}/admin`);
    if (aOnB.status >= 300 && aOnB.status < 400)
      pass("Operator A blocked from Operator B's admin");
    else fail("Cross-operator admin access should be blocked", String(aOnB.status));
  }

  // =========================================================================
  section("Phase E: existing customer pages and Mama Bears admin still work");
  {
    const home = await fetch(`${BASE}/r/mama-bears`, { redirect: "manual" });
    if (home.status === 200) pass("Mama Bears landing renders");
    else fail("Mama Bears landing", String(home.status));
    await home.body?.cancel();

    const menu = await fetch(`${BASE}/r/mama-bears/menu`, { redirect: "manual" });
    if (menu.status === 200) pass("Mama Bears menu renders");
    else fail("Mama Bears menu", String(menu.status));
    await menu.body?.cancel();

    // super_admin can act-as any restaurant admin
    const superJar = newJar();
    await submitForm(superJar, "/login", {
      email: "josh@platform.local",
      password: "super123!",
    });
    const superMB = await checkPage(superJar, "/r/mama-bears/admin");
    if (superMB.status === 200) pass("super_admin can still act-as restaurant admin");
    else fail("super_admin act-as", String(superMB.status));
    const superBCafe = await checkPage(superJar, "/r/op-b-cafe/admin");
    if (superBCafe.status === 200)
      pass("super_admin can also access operator B's client admin");
    else fail("super_admin → op-b-cafe", String(superBCafe.status));
  }

  // =========================================================================
  section("Phase F: cleanup");
  await db.user.deleteMany({
    where: { email: { in: ["op-a-test@platform.local", "op-b-test@platform.local"] } },
  });
  await db.restaurant.deleteMany({ where: { slug: "op-b-cafe" } });
  await db.operator.deleteMany({
    where: { email: { in: ["op-a-test@platform.local", "op-b-test@platform.local"] } },
  });
  pass("Test operators + restaurant removed");

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
