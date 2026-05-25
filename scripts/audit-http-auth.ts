/**
 * HTTP-level audit of the auth flow.
 * Exercises the real Server Action transport — fetches the login page,
 * extracts the action ID and bound args from the rendered HTML, POSTs the
 * form, captures the session cookie, then verifies protected routes.
 */

const BASE = "http://localhost:3000";

let passes = 0;
let failures = 0;
function pass(label: string) {
  passes++;
  console.log(`  ✓ ${label}`);
}
function fail(label: string, why?: string) {
  failures++;
  console.log(`  ✗ ${label}${why ? ` — ${why}` : ""}`);
}
function section(label: string) {
  console.log(`\n${label}`);
}

interface FormFields {
  actionRef: string;
  actionPayloadName: string;
  actionPayload: string;
  actionBoundName: string;
  actionBound: string;
  actionKey: string;
}

function extractServerActionFields(html: string): FormFields | null {
  // Find the form chunk that contains $ACTION_REF_1
  const refMatch = html.match(/name="(\$ACTION_REF_\d+)"/);
  if (!refMatch) return null;
  const refName = refMatch[1];
  const suffix = refName.split("_").pop()!;
  const inputs = html.match(/<input[^/]*\/>/g) ?? [];
  const find = (re: RegExp) => inputs.find((i) => re.test(i));
  const decode = (htmlStr: string): string =>
    htmlStr.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#x27;/g, "'");
  const valueOf = (input?: string) => {
    if (!input) return "";
    const m = input.match(/value="([^"]*)"/);
    return m ? decode(m[1]) : "";
  };
  const payload = find(new RegExp(`name="\\$ACTION_${suffix}:0"`));
  const bound = find(new RegExp(`name="\\$ACTION_${suffix}:1"`));
  const key = find(/name="\$ACTION_KEY"/);
  if (!payload || !key) return null;
  return {
    actionRef: refName,
    actionPayloadName: `$ACTION_${suffix}:0`,
    actionPayload: valueOf(payload),
    actionBoundName: bound ? `$ACTION_${suffix}:1` : "",
    actionBound: valueOf(bound),
    actionKey: valueOf(key),
  };
}

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

async function loginViaForm(
  jar: CookieJar,
  path: string,
  email: string,
  password: string
): Promise<{ status: number; redirected?: string }> {
  // 1. GET the login page to discover the action fields
  const getRes = await fetch(`${BASE}${path}`, {
    headers: { Cookie: cookieHeader(jar) },
  });
  captureCookies(jar, getRes);
  const html = await getRes.text();
  const fields = extractServerActionFields(html);
  if (!fields) throw new Error("Could not extract Server Action fields from login page");

  // 2. Build multipart form data
  const fd = new FormData();
  fd.append(fields.actionRef, "");
  fd.append(fields.actionPayloadName, fields.actionPayload);
  if (fields.actionBoundName) fd.append(fields.actionBoundName, fields.actionBound);
  fd.append("$ACTION_KEY", fields.actionKey);
  fd.append("email", email);
  fd.append("password", password);

  // 3. POST with redirect: 'manual' so we see the 303 from server actions
  const postRes = await fetch(`${BASE}${path}`, {
    method: "POST",
    body: fd,
    headers: { Cookie: cookieHeader(jar) },
    redirect: "manual",
  });
  captureCookies(jar, postRes);
  return {
    status: postRes.status,
    redirected: postRes.headers.get("location") ?? undefined,
  };
}

async function main() {
  console.log("🔐 HTTP Auth Audit\n");

  // =========================================================================
  section("Restaurant admin login + access flow");
  const ownerJar = newJar();
  const loginRes = await loginViaForm(
    ownerJar,
    "/r/mama-bears/admin/login",
    "owner@mamabears.local",
    "mama123!"
  );
  // Server actions return 303 on redirect()
  if (loginRes.status >= 300 && loginRes.status < 400) {
    pass(`Login responded with redirect (${loginRes.status} → ${loginRes.redirected})`);
  } else {
    fail("Login redirect", `status ${loginRes.status}`);
  }
  if (ownerJar.cookies.has("rp_session")) {
    pass("Session cookie set");
  } else {
    fail("Session cookie missing", JSON.stringify([...ownerJar.cookies.keys()]));
  }

  // Now hit admin dashboard with cookie
  const dashRes = await fetch(`${BASE}/r/mama-bears/admin`, {
    headers: { Cookie: cookieHeader(ownerJar) },
    redirect: "manual",
  });
  if (dashRes.status === 200) {
    pass(`Admin dashboard accessible (200)`);
    const dashHtml = await dashRes.text();
    if (dashHtml.includes("Today")) pass("Dashboard renders expected content");
    else fail("Dashboard content missing");
  } else {
    fail("Admin dashboard not accessible", `status ${dashRes.status}`);
  }

  const menuRes = await fetch(`${BASE}/r/mama-bears/admin/menu`, {
    headers: { Cookie: cookieHeader(ownerJar) },
    redirect: "manual",
  });
  if (menuRes.status === 200) pass("Admin menu page accessible (200)");
  else fail("Admin menu page", `status ${menuRes.status}`);

  const settingsRes = await fetch(`${BASE}/r/mama-bears/admin/settings`, {
    headers: { Cookie: cookieHeader(ownerJar) },
    redirect: "manual",
  });
  if (settingsRes.status === 200) pass("Admin settings page accessible (200)");
  else fail("Admin settings page", `status ${settingsRes.status}`);

  // =========================================================================
  section("Restaurant admin CANNOT access platform admin");
  const platRes = await fetch(`${BASE}/platform`, {
    headers: { Cookie: cookieHeader(ownerJar) },
    redirect: "manual",
  });
  if (platRes.status >= 300 && platRes.status < 400) {
    pass(`Restaurant admin → /platform redirects (${platRes.status})`);
  } else {
    fail("Platform should not be accessible to restaurant_admin", `status ${platRes.status}`);
  }

  // =========================================================================
  section("Super-admin login + cross-restaurant access");
  const superJar = newJar();
  const superLogin = await loginViaForm(
    superJar,
    "/platform/login",
    "josh@platform.local",
    "super123!"
  );
  if (superLogin.status >= 300 && superLogin.status < 400) {
    pass(`Super-admin login redirected to ${superLogin.redirected}`);
  } else {
    fail("Super-admin login redirect", `status ${superLogin.status}`);
  }
  if (superJar.cookies.has("rp_session")) pass("Super-admin session cookie set");
  else fail("Super-admin session missing");

  const platOk = await fetch(`${BASE}/platform`, {
    headers: { Cookie: cookieHeader(superJar) },
    redirect: "manual",
  });
  if (platOk.status === 200) pass("Super-admin can reach /platform");
  else fail("Super-admin /platform", `status ${platOk.status}`);

  const restListOk = await fetch(`${BASE}/platform/restaurants`, {
    headers: { Cookie: cookieHeader(superJar) },
    redirect: "manual",
  });
  if (restListOk.status === 200) pass("Super-admin can reach /platform/restaurants");
  else fail("Super-admin /platform/restaurants", `status ${restListOk.status}`);

  // Super-admin can act-as Mama Bears
  const superActAs = await fetch(`${BASE}/r/mama-bears/admin`, {
    headers: { Cookie: cookieHeader(superJar) },
    redirect: "manual",
  });
  if (superActAs.status === 200) {
    pass("Super-admin can act-as Mama Bears admin");
    const html = await superActAs.text();
    if (html.includes("super-admin")) pass("Super-admin banner shown on restaurant admin");
    else fail("Super-admin banner not shown");
  } else {
    fail("Super-admin act-as failed", `status ${superActAs.status}`);
  }

  // =========================================================================
  section("Login with wrong password is rejected");
  const failJar = newJar();
  const badRes = await loginViaForm(
    failJar,
    "/r/mama-bears/admin/login",
    "owner@mamabears.local",
    "wrong-password"
  );
  if (badRes.status === 200) {
    // Server action returned form state, didn't redirect — that's the success criterion here
    pass("Bad password did NOT redirect (form re-rendered with error)");
  } else if (badRes.status >= 300 && badRes.status < 400) {
    fail("Bad password should not redirect", `status ${badRes.status}`);
  } else {
    pass(`Bad password rejected (status ${badRes.status})`);
  }
  if (!failJar.cookies.has("rp_session")) pass("No session cookie set on failed login");
  else fail("Session cookie was set on failed login!");

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`Result: ${passes} passed, ${failures} failed.`);
  if (failures > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
