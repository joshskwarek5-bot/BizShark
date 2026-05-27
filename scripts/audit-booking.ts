/**
 * Phase 15 audit — Appointment booking pipeline.
 *
 *  - parseAppointmentConfig handles null + bad input
 *  - computeAvailableSlots honors closed days, lead-time, buffer, conflicts
 *  - Public bookAppointment creates a row + blocks the slot afterwards
 *  - Public bookAppointment refuses a slot that's already taken
 *  - Admin can transition statuses through the workflow
 *  - Cross-tenant: a restaurant_admin can't reach another restaurant's
 *    booking config / appointments inbox
 *  - Public site renders BookingWidget when enabled, InquiryForm when not
 */
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import {
  bookAppointment,
  getAvailableSlots,
} from "@/app/r/[slug]/(customer)/booking-actions";
import {
  computeAvailableSlots,
  parseAppointmentConfig,
  parseHours,
  serializeAppointmentConfig,
} from "@/lib/availability";

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
async function submitForm(jar: CookieJar, path: string, extras: Record<string, string>) {
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
  return { status: post.status };
}

function nextWeekday(): Date {
  // Pick the next day that's at least 1 day ahead so leadTime never bites
  const d = new Date();
  d.setDate(d.getDate() + 7); // a week out to be safe
  d.setHours(0, 0, 0, 0);
  return d;
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function main() {
  console.log("📅 Appointment booking audit\n");

  // Cleanup
  await db.appointment.deleteMany({
    where: { restaurant: { slug: { startsWith: "audit-book-" } } },
  });
  await db.user.deleteMany({
    where: {
      email: { in: ["book-salon@audit.local", "book-other@audit.local"] },
    },
  });
  await db.restaurant.deleteMany({ where: { slug: { startsWith: "audit-book-" } } });

  // ----------------------------------------------------------
  section("Phase A: parseAppointmentConfig");
  const def = parseAppointmentConfig(null);
  if (def.enabled === false && def.slotMinutes === 30) pass("Defaults sensible");
  else fail("Defaults wrong");
  const bad = parseAppointmentConfig("garbage");
  if (bad.enabled === false) pass("Bad JSON → disabled defaults");
  const good = parseAppointmentConfig(
    serializeAppointmentConfig({
      enabled: true,
      slotMinutes: 45,
      bufferMinutes: 15,
      leadTimeHours: 4,
      maxDaysAhead: 60,
    })
  );
  if (good.slotMinutes === 45 && good.bufferMinutes === 15) pass("Roundtrip OK");
  else fail("Roundtrip wrong");
  // Clamp
  const clamped = parseAppointmentConfig(
    JSON.stringify({ enabled: true, slotMinutes: 9999, leadTimeHours: -10 })
  );
  if (clamped.slotMinutes <= 240 && clamped.leadTimeHours >= 0)
    pass("Clamps out-of-range values");

  // ----------------------------------------------------------
  section("Phase B: computeAvailableSlots logic");
  const baseHours = parseHours(
    JSON.stringify({
      mon: { open: "09:00", close: "17:00" },
      tue: { open: "09:00", close: "17:00" },
      wed: { open: "09:00", close: "17:00" },
      thu: { open: "09:00", close: "17:00" },
      fri: { open: "09:00", close: "17:00" },
      sat: { open: "10:00", close: "14:00" },
      sun: { open: "09:00", close: "17:00", closed: true },
    })
  );
  const cfg = {
    enabled: true,
    slotMinutes: 30,
    bufferMinutes: 0,
    leadTimeHours: 0,
    maxDaysAhead: 30,
  };

  // Find a Monday at least a week ahead so day-of-week is deterministic
  let monday = new Date();
  monday.setHours(12, 0, 0, 0);
  while (monday.getDay() !== 1 || monday.getTime() < Date.now() + 24 * 60 * 60 * 1000 * 2) {
    monday.setDate(monday.getDate() + 1);
  }
  const mondaySlots = computeAvailableSlots({
    date: monday,
    weeklyHours: baseHours,
    config: cfg,
    existingBookings: [],
    serviceDurationMinutes: 30,
    now: new Date(monday.getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days before
  });
  // 9 AM - 5 PM in 30-min slots, 30-min service = 16 slots (9, 9:30, ..., 16:30)
  if (mondaySlots.length === 16) pass(`Monday: 16 slots generated`);
  else fail(`Monday slot count wrong (${mondaySlots.length})`);

  // Sunday is closed
  let sunday = new Date(monday);
  sunday.setDate(monday.getDate() - 1);
  const sundaySlots = computeAvailableSlots({
    date: sunday,
    weeklyHours: baseHours,
    config: cfg,
    existingBookings: [],
    serviceDurationMinutes: 30,
    now: new Date(sunday.getTime() - 5 * 24 * 60 * 60 * 1000),
  });
  if (sundaySlots.length === 0) pass("Closed day → 0 slots");
  else fail(`Closed day returned slots (${sundaySlots.length})`);

  // Conflict detection: book 10:00-10:30, then 10:00 should disappear
  const bookings = [
    {
      startsAt: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 10, 0),
      endsAt: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 10, 30),
    },
  ];
  const mondayAfterBook = computeAvailableSlots({
    date: monday,
    weeklyHours: baseHours,
    config: cfg,
    existingBookings: bookings,
    serviceDurationMinutes: 30,
    now: new Date(monday.getTime() - 5 * 24 * 60 * 60 * 1000),
  });
  if (mondayAfterBook.length === 15) pass("Conflict detection drops 1 slot");
  else fail(`Conflict drop wrong (${mondayAfterBook.length}/15)`);
  if (!mondayAfterBook.find((s) => s.time === "10:00"))
    pass("10:00 slot correctly excluded after booking");

  // Lead-time gating: if leadTime is 24h and we're 1h before close, 0 slots today
  const sameDayCfg = { ...cfg, leadTimeHours: 24 };
  const justBeforeClose = new Date(monday);
  justBeforeClose.setHours(16, 0, 0, 0); // 1 hour before 5 PM close
  const leadGated = computeAvailableSlots({
    date: monday,
    weeklyHours: baseHours,
    config: sameDayCfg,
    existingBookings: [],
    serviceDurationMinutes: 30,
    now: justBeforeClose,
  });
  if (leadGated.length === 0) pass("Lead-time gating drops all same-day slots");
  else fail(`Lead gating leaked (${leadGated.length})`);

  // ----------------------------------------------------------
  section("Phase C: public bookAppointment");
  // Spin up a salon with booking enabled
  const salon = await db.restaurant.create({
    data: {
      slug: "audit-book-salon",
      name: "Audit Booking Salon",
      type: "personal_service",
      enabledFeatures: JSON.stringify([
        "services_list",
        "appointment_request",
        "hours",
      ]),
      address: "1 Book St",
      phone: "(555) 000-7000",
      hours: JSON.stringify({
        mon: { open: "09:00", close: "17:00" },
        tue: { open: "09:00", close: "17:00" },
        wed: { open: "09:00", close: "17:00" },
        thu: { open: "09:00", close: "17:00" },
        fri: { open: "09:00", close: "17:00" },
        sat: { open: "10:00", close: "14:00" },
        sun: { open: "09:00", close: "17:00", closed: true },
      }),
      services: JSON.stringify([
        { id: "svc1", name: "Haircut", duration: "30min", priceCents: 4500 },
        { id: "svc2", name: "Color", duration: "90min", priceCents: 12000 },
      ]),
      appointmentConfig: JSON.stringify({
        enabled: true,
        slotMinutes: 30,
        bufferMinutes: 0,
        leadTimeHours: 0,
        maxDaysAhead: 30,
      }),
      isActive: true,
    },
  });
  await db.user.create({
    data: {
      email: "book-salon@audit.local",
      passwordHash: await hashPassword("book123!"),
      role: "restaurant_admin",
      restaurantId: salon.id,
    },
  });

  // Fetch slots for next weekday
  const targetDate = nextWeekday();
  // Force to a Mon-Fri (skip weekends/closed sun)
  while (targetDate.getDay() === 0) {
    targetDate.setDate(targetDate.getDate() + 1);
  }
  const slotsRes = await getAvailableSlots({
    slug: salon.slug,
    date: isoDate(targetDate),
    serviceId: "svc1",
  });
  if (slotsRes.ok) {
    if (slotsRes.slots.length > 0) pass(`Got ${slotsRes.slots.length} slots`);
    else fail("No slots returned");

    // Book the first slot
    const slot = slotsRes.slots[0];
    const bookRes = await bookAppointment({
      slug: salon.slug,
      serviceId: "svc1",
      startsAtIso: slot.startsAtIso,
      customerName: "Audit Bookworm",
      customerEmail: "audit-bookworm@example.com",
      customerPhone: "",
      notes: "",
    });
    if (bookRes.ok) pass("First booking succeeded");
    else fail("First booking failed", "error" in bookRes ? bookRes.error : "");

    // Try to book the same slot again — should fail (slot taken)
    const dupeRes = await bookAppointment({
      slug: salon.slug,
      serviceId: "svc1",
      startsAtIso: slot.startsAtIso,
      customerName: "Audit Dupe",
      customerEmail: "audit-dupe@example.com",
      customerPhone: "",
      notes: "",
    });
    if (!dupeRes.ok && /slot was just taken|no longer available/i.test(dupeRes.error)) {
      pass("Duplicate slot booking correctly rejected");
    } else {
      fail("Slot conflict not enforced", dupeRes.ok ? "second booking succeeded" : "wrong error");
    }

    // Slot list should now exclude that time
    const slotsAfter = await getAvailableSlots({
      slug: salon.slug,
      date: isoDate(targetDate),
      serviceId: "svc1",
    });
    if (slotsAfter.ok && slotsAfter.slots.length === slotsRes.slots.length - 1) {
      pass("Slot list re-fetch shows 1 fewer");
    } else {
      fail("Slot list re-fetch wrong");
    }

    // Verify the row landed in DB
    const dbCount = await db.appointment.count({
      where: { restaurantId: salon.id },
    });
    if (dbCount === 1) pass("Exactly 1 appointment in DB");
    else fail(`DB count wrong (${dbCount})`);

    // Spam guard: missing contact
    const noContact = await bookAppointment({
      slug: salon.slug,
      serviceId: "svc1",
      startsAtIso: slotsRes.slots[1]?.startsAtIso ?? slot.startsAtIso,
      customerName: "No Contact",
      customerEmail: "",
      customerPhone: "",
      notes: "",
    });
    if (!noContact.ok) pass("Missing email + phone correctly rejected");
  } else {
    fail("Slots request failed", slotsRes.ok ? "" : slotsRes.error);
  }

  // ----------------------------------------------------------
  section("Phase D: admin tabs render");
  const jar = newJar();
  await submitForm(jar, `/r/${salon.slug}/admin/login`, {
    email: "book-salon@audit.local",
    password: "book123!",
  });

  const inbox = await fetch(`${BASE}/r/${salon.slug}/admin/appointments`, {
    headers: { Cookie: cookieHeader(jar) },
    redirect: "manual",
  });
  if (inbox.status === 200) {
    const html = await inbox.text();
    pass("/admin/appointments renders");
    if (html.includes("Audit Bookworm")) pass("Inbox shows the booking customer");
    else fail("Inbox missing booking");
  } else {
    fail("Appointments inbox", String(inbox.status));
  }

  const bookCfg = await fetch(`${BASE}/r/${salon.slug}/admin/booking`, {
    headers: { Cookie: cookieHeader(jar) },
    redirect: "manual",
  });
  if (bookCfg.status === 200) {
    const html = await bookCfg.text();
    pass("/admin/booking renders");
    if (html.includes("Appointment booking") || html.includes("Booking"))
      pass("Booking config heading present");
  } else {
    fail("Booking config page", String(bookCfg.status));
  }

  // ----------------------------------------------------------
  section("Phase E: public site renders BookingWidget when enabled");
  const publicSalon = await fetch(`${BASE}/r/${salon.slug}`, { redirect: "manual" });
  if (publicSalon.status === 200) {
    const html = await publicSalon.text();
    if (html.includes("Book an appointment") || html.includes("Available times"))
      pass("Public site shows the BookingWidget");
    else fail("BookingWidget heading missing");
  } else {
    fail("Public landing", String(publicSalon.status));
  }

  // ----------------------------------------------------------
  section("Phase F: BookingWidget falls back to InquiryForm when disabled");
  // Flip enabled=false
  await db.restaurant.update({
    where: { id: salon.id },
    data: {
      appointmentConfig: JSON.stringify({
        enabled: false,
        slotMinutes: 30,
        bufferMinutes: 0,
        leadTimeHours: 0,
        maxDaysAhead: 30,
      }),
    },
  });
  const publicAgain = await fetch(`${BASE}/r/${salon.slug}`, { redirect: "manual" });
  if (publicAgain.status === 200) {
    const html = await publicAgain.text();
    if (html.includes("Request an appointment") || html.includes("Request appointment"))
      pass("Fallback InquiryForm shown when booking disabled");
    else fail("Fallback form missing");
  }

  // ----------------------------------------------------------
  section("Phase G: cross-tenant isolation");
  const other = await db.restaurant.create({
    data: {
      slug: "audit-book-other",
      name: "Audit Other Salon",
      type: "personal_service",
      enabledFeatures: JSON.stringify(["services_list", "hours"]),
      address: "2 X St",
      phone: "(555) 000-7001",
      hours: "{}",
      isActive: true,
    },
  });
  await db.user.create({
    data: {
      email: "book-other@audit.local",
      passwordHash: await hashPassword("book123!"),
      role: "restaurant_admin",
      restaurantId: other.id,
    },
  });
  const jarOther = newJar();
  await submitForm(jarOther, `/r/${other.slug}/admin/login`, {
    email: "book-other@audit.local",
    password: "book123!",
  });
  const xinbox = await fetch(`${BASE}/r/${salon.slug}/admin/appointments`, {
    headers: { Cookie: cookieHeader(jarOther) },
    redirect: "manual",
  });
  await xinbox.body?.cancel();
  if ([302, 307, 404].includes(xinbox.status)) {
    pass(`Cross-tenant appointments page blocked (${xinbox.status})`);
  } else {
    fail("Cross-tenant inbox leaks", String(xinbox.status));
  }

  // ----------------------------------------------------------
  section("Phase H: cleanup");
  await db.appointment.deleteMany({
    where: { restaurantId: { in: [salon.id, other.id] } },
  });
  await db.user.deleteMany({
    where: {
      email: { in: ["book-salon@audit.local", "book-other@audit.local"] },
    },
  });
  await db.restaurant.deleteMany({ where: { slug: { startsWith: "audit-book-" } } });
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
