/**
 * Phase 6 audit — Marketing landing page at `/`.
 *
 *  - Unauthed `/` returns 200 with the marketing landing (not a restaurant redirect)
 *  - Marketing content present: hero, how-it-works, pricing, FAQ, CTA
 *  - Sample-site section links to /r/mama-bears
 *  - Signed-in operator hitting `/` is redirected to /app
 *  - Signed-in super_admin hitting `/` is redirected to /platform
 *  - Signed-in restaurant_admin hitting `/` is redirected to /r/<slug>/admin
 */

const BASE = "http://localhost:3000";

let passes = 0;
let failures = 0;
const pass = (l: string) => { passes++; console.log(`  ✓ ${l}`); };
const fail = (l: string, why?: string) => {
  failures++;
  console.log(`  ✗ ${l}${why ? ` — ${why}` : ""}`);
};
const section = (l: string) => console.log(`\n${l}`);

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
  for (const [k, v] of Object.entries(extraFields)) fd.append(k, v);
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

async function checkRedirect(jar: CookieJar, path: string) {
  const r = await fetch(`${BASE}${path}`, {
    headers: { Cookie: cookieHeader(jar) },
    redirect: "manual",
  });
  await r.body?.cancel();
  return { status: r.status, location: r.headers.get("location") ?? undefined };
}

async function main() {
  console.log("🌐 Marketing Landing Audit\n");

  section("Phase A: unauthed `/` returns marketing landing");
  const home = await fetch(BASE, { redirect: "manual" });
  if (home.status === 200) pass("/ returns 200 (no redirect)");
  else fail("/ should return 200", String(home.status));
  const html = await home.text();

  // Key marketing sections — looking for headline + nav items
  for (const phrase of [
    "Quit your 9-to-5",
    "Mainpost",
    "How it works",
    "Three steps to your first paying client",
    "Pricing",
    "Pay yourself first",
    "Most popular",
    "Starter",
    "Pro",
    "Agency",
    "Start free",
    "14-day free trial",
  ]) {
    if (html.includes(phrase)) pass(`/ contains "${phrase}"`);
    else fail(`/ missing "${phrase}"`);
  }

  // Sample-site link
  if (html.includes("/r/mama-bears")) pass("/ links to /r/mama-bears sample");
  else fail("/ missing sample-site link");

  section("Phase B: signed-in users are redirected from `/` to their dashboard");

  // Operator → /app
  const opJar = newJar();
  await submitForm(opJar, "/login", {
    email: "agency@platform.local",
    password: "operator123!",
  });
  const opHome = await checkRedirect(opJar, "/");
  if (opHome.status >= 300 && opHome.status < 400 && opHome.location === "/app")
    pass("operator GET / → /app (redirect)");
  else fail("operator / should redirect to /app", `${opHome.status} → ${opHome.location}`);

  // Super admin → /platform
  const superJar = newJar();
  await submitForm(superJar, "/login", {
    email: "josh@platform.local",
    password: "super123!",
  });
  const superHome = await checkRedirect(superJar, "/");
  if (
    superHome.status >= 300 &&
    superHome.status < 400 &&
    superHome.location === "/platform"
  )
    pass("super_admin GET / → /platform (redirect)");
  else
    fail(
      "super_admin / should redirect to /platform",
      `${superHome.status} → ${superHome.location}`
    );

  // Restaurant admin → /r/<slug>/admin
  const raJar = newJar();
  await submitForm(raJar, "/login", {
    email: "owner@mamabears.local",
    password: "mama123!",
  });
  const raHome = await checkRedirect(raJar, "/");
  if (
    raHome.status >= 300 &&
    raHome.status < 400 &&
    raHome.location?.includes("/r/mama-bears/admin")
  )
    pass("restaurant_admin GET / → /r/mama-bears/admin (redirect)");
  else
    fail(
      "restaurant_admin / should redirect to admin",
      `${raHome.status} → ${raHome.location}`
    );

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`Result: ${passes} passed, ${failures} failed.`);
  if (failures > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
