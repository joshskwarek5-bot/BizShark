/**
 * Phase 14 audit — Vertical entities (Staff/ClassSession/Testimonial/Gallery/FAQ).
 *
 *  - All five new models exist + accept basic CRUD via Prisma
 *  - Restaurant-scoped (cross-tenant guard)
 *  - Public landing renders team grid + schedule + gallery + testimonials
 *    + FAQ when present
 *  - Admin tabs (/r/<slug>/admin/team, /classes, /gallery) render for the
 *    right business types only
 *  - Cross-tenant: a restaurant_admin can't reach another restaurant's tabs
 */
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

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

async function main() {
  console.log("✂️  Vertical entities audit\n");

  // Cleanup
  await db.staff.deleteMany({ where: { restaurant: { slug: { startsWith: "audit-vert-" } } } });
  await db.classSession.deleteMany({ where: { restaurant: { slug: { startsWith: "audit-vert-" } } } });
  await db.testimonial.deleteMany({ where: { restaurant: { slug: { startsWith: "audit-vert-" } } } });
  await db.galleryImage.deleteMany({ where: { restaurant: { slug: { startsWith: "audit-vert-" } } } });
  await db.faq.deleteMany({ where: { restaurant: { slug: { startsWith: "audit-vert-" } } } });
  await db.user.deleteMany({
    where: { email: { in: ["vert-salon@audit.local", "vert-gym@audit.local", "vert-other@audit.local"] } },
  });
  await db.restaurant.deleteMany({ where: { slug: { startsWith: "audit-vert-" } } });

  // Make a salon + gym restaurant with admins
  const salon = await db.restaurant.create({
    data: {
      slug: "audit-vert-salon",
      name: "Audit Salon",
      type: "personal_service",
      enabledFeatures: JSON.stringify([
        "services_list",
        "appointment_request",
        "gallery",
        "testimonials",
        "hours",
      ]),
      address: "1 Hair St",
      phone: "(555) 000-0011",
      hours: "{}",
      isActive: true,
    },
  });
  await db.user.create({
    data: {
      email: "vert-salon@audit.local",
      passwordHash: await hashPassword("vert123!"),
      role: "restaurant_admin",
      restaurantId: salon.id,
    },
  });
  const gym = await db.restaurant.create({
    data: {
      slug: "audit-vert-gym",
      name: "Audit Gym",
      type: "fitness",
      enabledFeatures: JSON.stringify([
        "services_list",
        "appointment_request",
        "gallery",
        "testimonials",
        "hours",
      ]),
      address: "2 Iron Way",
      phone: "(555) 000-0022",
      hours: "{}",
      isActive: true,
    },
  });
  await db.user.create({
    data: {
      email: "vert-gym@audit.local",
      passwordHash: await hashPassword("vert123!"),
      role: "restaurant_admin",
      restaurantId: gym.id,
    },
  });

  // ----------------------------------------------------------
  section("Phase A: schema basic CRUD");
  const staff = await db.staff.create({
    data: {
      restaurantId: salon.id,
      name: "Maya Audit",
      title: "Senior Stylist",
      bio: "Specializes in audit-grade balayage.",
      specialties: JSON.stringify(["balayage", "curly cuts"]),
      bookingUrl: "https://booksy.com/u/audit-maya",
    },
  });
  if (staff.id) pass("Staff row created");
  const cls = await db.classSession.create({
    data: {
      restaurantId: gym.id,
      name: "Audit WOD",
      dayOfWeek: "mon",
      startTime: "06:00",
      endTime: "07:00",
      level: "all-levels",
    },
  });
  if (cls.id) pass("ClassSession row created");
  const test = await db.testimonial.create({
    data: { restaurantId: salon.id, quote: "Audit-grade quote.", author: "Aud R." },
  });
  if (test.id) pass("Testimonial row created");
  const img = await db.galleryImage.create({
    data: { restaurantId: salon.id, imageUrl: "/audit-test.jpg", tag: "cuts" },
  });
  if (img.id) pass("GalleryImage row created");
  const faq = await db.faq.create({
    data: { restaurantId: salon.id, question: "Audit Q?", answer: "Audit A." },
  });
  if (faq.id) pass("Faq row created");

  // ----------------------------------------------------------
  section("Phase B: public landing renders new sections");
  const publicSalon = await fetch(`${BASE}/r/${salon.slug}`, { redirect: "manual" });
  if (publicSalon.status === 200) {
    const html = await publicSalon.text();
    pass("Salon public landing 200");
    if (html.includes("Maya Audit")) pass("Team grid renders staff name");
    else fail("Team section missing staff");
    if (html.includes("Audit-grade quote")) pass("Testimonials render");
    else fail("Testimonials missing");
    if (html.includes("Audit Q?")) pass("FAQ renders");
    else fail("FAQ missing");
    if (html.includes("/audit-test.jpg")) pass("Gallery renders image");
    else fail("Gallery missing image src");
  } else {
    fail("Salon landing", String(publicSalon.status));
  }

  const publicGym = await fetch(`${BASE}/r/${gym.slug}`, { redirect: "manual" });
  if (publicGym.status === 200) {
    const html = await publicGym.text();
    pass("Gym public landing 200");
    if (html.includes("Audit WOD")) pass("Schedule renders class");
    else fail("Schedule missing class");
    if (html.includes("Class schedule")) pass("Schedule heading present");
    else fail("Schedule heading missing");
  } else {
    fail("Gym landing", String(publicGym.status));
  }

  // ----------------------------------------------------------
  section("Phase C: admin tabs accessible for restaurant_admin");
  const jarSalon = newJar();
  await submitForm(jarSalon, `/r/${salon.slug}/admin/login`, {
    email: "vert-salon@audit.local",
    password: "vert123!",
  });
  const salonTeam = await fetch(`${BASE}/r/${salon.slug}/admin/team`, {
    headers: { Cookie: cookieHeader(jarSalon) },
    redirect: "manual",
  });
  if (salonTeam.status === 200) {
    const html = await salonTeam.text();
    pass("Salon /admin/team renders");
    if (html.includes("Maya Audit")) pass("Team page lists existing staff");
  } else {
    fail("Salon team page", String(salonTeam.status));
  }
  const salonGallery = await fetch(`${BASE}/r/${salon.slug}/admin/gallery`, {
    headers: { Cookie: cookieHeader(jarSalon) },
    redirect: "manual",
  });
  if (salonGallery.status === 200) pass("Salon /admin/gallery renders");
  else fail("Gallery page", String(salonGallery.status));

  const jarGym = newJar();
  await submitForm(jarGym, `/r/${gym.slug}/admin/login`, {
    email: "vert-gym@audit.local",
    password: "vert123!",
  });
  const gymClasses = await fetch(`${BASE}/r/${gym.slug}/admin/classes`, {
    headers: { Cookie: cookieHeader(jarGym) },
    redirect: "manual",
  });
  if (gymClasses.status === 200) {
    const html = await gymClasses.text();
    pass("Gym /admin/classes renders");
    if (html.includes("Audit WOD")) pass("Classes page lists existing class");
  } else {
    fail("Gym classes page", String(gymClasses.status));
  }

  // ----------------------------------------------------------
  section("Phase D: nav reflects feature flags");
  const adminPageSalon = await fetch(`${BASE}/r/${salon.slug}/admin`, {
    headers: { Cookie: cookieHeader(jarSalon) },
    redirect: "manual",
  });
  if (adminPageSalon.status === 200) {
    const html = await adminPageSalon.text();
    if (html.includes(`/r/${salon.slug}/admin/team`)) pass("Team tab in salon nav");
    else fail("Team tab missing from salon nav");
    if (html.includes(`/r/${salon.slug}/admin/gallery`)) pass("Gallery tab in salon nav");
    else fail("Gallery tab missing from salon nav");
    // Classes should NOT show for salon
    if (!html.includes(`/r/${salon.slug}/admin/classes`))
      pass("Classes tab correctly HIDDEN for salon");
    else fail("Classes tab leaked into salon nav");
  }
  const adminPageGym = await fetch(`${BASE}/r/${gym.slug}/admin`, {
    headers: { Cookie: cookieHeader(jarGym) },
    redirect: "manual",
  });
  if (adminPageGym.status === 200) {
    const html = await adminPageGym.text();
    if (html.includes(`/r/${gym.slug}/admin/classes`)) pass("Classes tab in gym nav");
    else fail("Classes tab missing from gym nav");
    if (html.includes(`/r/${gym.slug}/admin/team`)) pass("Team tab in gym nav");
    else fail("Team tab missing from gym nav");
  }

  // ----------------------------------------------------------
  section("Phase E: cross-tenant isolation");
  // Salon admin can't see gym's tabs
  const xenTeam = await fetch(`${BASE}/r/${gym.slug}/admin/team`, {
    headers: { Cookie: cookieHeader(jarSalon) },
    redirect: "manual",
  });
  await xenTeam.body?.cancel();
  if ([302, 307, 404].includes(xenTeam.status)) {
    pass(`Cross-tenant team page blocked (${xenTeam.status})`);
  } else {
    fail("Cross-tenant team leaks", String(xenTeam.status));
  }

  // ----------------------------------------------------------
  section("Phase F: cleanup");
  await db.staff.deleteMany({ where: { restaurantId: { in: [salon.id, gym.id] } } });
  await db.classSession.deleteMany({ where: { restaurantId: { in: [salon.id, gym.id] } } });
  await db.testimonial.deleteMany({ where: { restaurantId: { in: [salon.id, gym.id] } } });
  await db.galleryImage.deleteMany({ where: { restaurantId: { in: [salon.id, gym.id] } } });
  await db.faq.deleteMany({ where: { restaurantId: { in: [salon.id, gym.id] } } });
  await db.user.deleteMany({
    where: { email: { in: ["vert-salon@audit.local", "vert-gym@audit.local"] } },
  });
  await db.restaurant.deleteMany({ where: { slug: { startsWith: "audit-vert-" } } });
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
