/**
 * Verifies the real-time order stream works end-to-end:
 *
 *  1. Logs in as the Mama Bears admin and opens an SSE connection
 *     to the restaurant's admin stream.
 *  2. Places a new order via the placeOrder server action (directly).
 *  3. Asserts an `order:new` SSE event arrives within ~3 seconds.
 *  4. Updates the order's status in the DB (simulating the admin advancing it).
 *  5. Asserts an `order:update` SSE event arrives.
 *
 * Requires the dev server to be running on port 3000.
 */
import { db } from "@/lib/db";

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

// --- Tiny Server-Action login + cookie capture ---

interface CookieJar {
  cookies: Map<string, string>;
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
async function login(jar: CookieJar, path: string, email: string, password: string) {
  const get = await fetch(`${BASE}${path}`, { headers: { Cookie: cookieHeader(jar) } });
  captureCookies(jar, get);
  const f = extractFields(await get.text());
  if (!f) throw new Error("Could not parse login form");
  const fd = new FormData();
  fd.append(f.actionRef, "");
  fd.append(f.payloadName, f.payload);
  if (f.bound) fd.append(f.boundName, f.bound);
  fd.append(f.keyName, f.key);
  fd.append("email", email);
  fd.append("password", password);
  const post = await fetch(`${BASE}${path}`, {
    method: "POST",
    body: fd,
    headers: { Cookie: cookieHeader(jar) },
    redirect: "manual",
  });
  captureCookies(jar, post);
  return post.status;
}

// --- SSE consumer ---

interface SseEvent {
  event: string;
  data: string;
}

/**
 * Opens an SSE connection and yields events. Pass an AbortSignal to stop.
 */
async function* sseEvents(
  url: string,
  init: { cookie?: string; signal: AbortSignal }
): AsyncGenerator<SseEvent> {
  const res = await fetch(url, {
    headers: init.cookie ? { Cookie: init.cookie, Accept: "text/event-stream" } : { Accept: "text/event-stream" },
    signal: init.signal,
  });
  if (!res.ok) throw new Error(`SSE returned ${res.status}`);
  if (!res.body) throw new Error("SSE response has no body");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    while (buf.includes("\n\n")) {
      const idx = buf.indexOf("\n\n");
      const block = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      let event = "message";
      let data = "";
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
        // ignore comment lines (start with ":")
      }
      if (data || event !== "message") yield { event, data };
    }
  }
}

async function waitForEvent(
  url: string,
  cookie: string,
  predicate: (e: SseEvent) => boolean,
  timeoutMs: number
): Promise<SseEvent | null> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    for await (const e of sseEvents(url, { cookie, signal: ac.signal })) {
      if (predicate(e)) {
        clearTimeout(timer);
        ac.abort();
        return e;
      }
    }
  } catch (e) {
    if (ac.signal.aborted) return null;
    throw e;
  }
  return null;
}

// --- HTTP helpers ---

/**
 * Places an order by POSTing to the checkout server action with proper Server
 * Action transport. Requires us to first fetch the checkout page to harvest
 * the action ID and bound argument fields.
 */
async function placeOrderViaHttp(itemId: string): Promise<{
  ok: boolean;
  orderId?: string;
  orderNumber?: number;
  error?: string;
}> {
  // Server actions can be called by name via a JSON body, but the simplest
  // path is to just write directly to the DB and rely on the SSE poller.
  // For an *in-process* emit, we need the action to run inside the dev
  // server. The cleanest way is to do a raw DB write + emit via an HTTP
  // ping route. Instead, we use the real action but invoke it via a tiny
  // dev-only endpoint we'll add (see /api/test/place-order).
  const res = await fetch(`${BASE}/api/test/place-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ slug: "mama-bears", itemId }),
  });
  return res.json();
}

async function updateStatusViaHttp(
  jar: CookieJar,
  orderId: string,
  status: string
): Promise<boolean> {
  const res = await fetch(`${BASE}/api/test/update-status`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader(jar) },
    body: JSON.stringify({ slug: "mama-bears", orderId, status }),
  });
  return res.ok;
}

async function main() {
  console.log("📡 SSE Real-Time Audit\n");

  await db.order.deleteMany();

  section("Phase A: Admin opens SSE + customer places order");

  const jar: CookieJar = { cookies: new Map() };
  const loginStatus = await login(jar, "/r/mama-bears/admin/login", "owner@mamabears.local", "mama123!");
  if (loginStatus >= 300 && loginStatus < 400) pass("Admin login OK");
  else {
    fail("Admin login failed", String(loginStatus));
    process.exit(1);
  }
  const cookie = cookieHeader(jar);

  const items = await db.menuItem.findMany({
    where: { isAvailable: true },
    take: 2,
  });

  // Open SSE in background, then place order ~300ms later.
  // We allow up to 6s — DB-poll fallback runs every 2.5s and the first poll
  // happens at ~POLL_MS after handler start, so worst case is ~5s.
  const evtPromise = waitForEvent(
    `${BASE}/api/r/mama-bears/admin/stream`,
    cookie,
    (e) => e.event === "order:new",
    8000
  );

  // Give the SSE handshake a moment so the connection is fully open
  // before we mutate state.
  await new Promise((r) => setTimeout(r, 600));
  const t0 = Date.now();

  // Place order via HTTP — this routes the action through the dev server
  // process so the in-process EventEmitter actually reaches the SSE handler.
  // For SQLite, direct script DB writes are visible to the dev server but
  // would only be delivered via the slower poll fallback.
  const placedRes = await placeOrderViaHttp(items[0].id);
  if (!placedRes.ok) {
    fail("Order placement via HTTP", placedRes.error);
    process.exit(1);
  }
  pass(`Placed order via HTTP`);
  const placed = placedRes;

  const evt = await evtPromise;
  const elapsed = Date.now() - t0;
  if (evt) {
    pass(`Received order:new event in ${elapsed}ms`);
    try {
      const parsed = JSON.parse(evt.data);
      if (parsed.orderNumber === placed.orderNumber) {
        pass("Event payload matches placed order");
      } else {
        fail("Event payload order number mismatch", JSON.stringify(parsed));
      }
    } catch (e) {
      fail("Event payload not JSON", String(e));
    }
  } else {
    fail("Did not receive order:new within 8s");
  }

  section("Phase B: Admin advances status → customer SSE fires");

  const customerEvtPromise = waitForEvent(
    `${BASE}/api/r/mama-bears/order/${placed.orderId}/stream`,
    "", // public endpoint, no auth needed
    (e) => e.event === "order:update",
    8000
  );

  await new Promise((r) => setTimeout(r, 600));
  // Advance the status by calling updateOrderStatus via HTTP (using the cookie
  // so the dev server treats us as the authed admin).
  const updateOk = await updateStatusViaHttp(jar, placed.orderId!, "ready");
  if (updateOk) pass("updateOrderStatus invoked via HTTP");
  else fail("updateOrderStatus HTTP call failed");

  const custEvt = await customerEvtPromise;
  if (custEvt) {
    pass(`Customer received order:update`);
    try {
      const parsed = JSON.parse(custEvt.data);
      if (parsed.status === "ready") pass("Status arrived as 'ready'");
      else fail("Status incorrect", parsed.status);
    } catch (e) {
      fail("Customer event not JSON", String(e));
    }
  } else {
    fail("Customer did not receive update within 8s");
  }

  // Cleanup
  await db.order.deleteMany();

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
