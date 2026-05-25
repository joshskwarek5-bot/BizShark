import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const MAMA_BEARS_HOURS = {
  mon: { open: "06:00", close: "14:00" },
  tue: { open: "06:00", close: "14:00" },
  wed: { open: "06:00", close: "14:00" },
  thu: { open: "06:00", close: "14:00" },
  fri: { open: "06:00", close: "14:00" },
  sat: { open: "07:00", close: "14:00" },
  sun: { open: "07:00", close: "14:00" },
};

// All prices in cents.
type ItemSeed = { name: string; description?: string; priceCents: number };
type CategorySeed = {
  name: string;
  description?: string;
  items: ItemSeed[];
};

const MAMA_BEARS_MENU: CategorySeed[] = [
  {
    name: "Omelets",
    description: "Served with country potatoes and toast.",
    items: [
      { name: "Juniper", description: "Bacon, onion, spinach smothered in green chili and cheese.", priceCents: 1595 },
      { name: "Bam Bam", description: "Sirloin chunks, mushrooms, onions and cheese.", priceCents: 1595 },
      { name: "Veggie", description: "Onions, tomatoes, peppers, mushrooms, spinach and cheese.", priceCents: 1595 },
      { name: "Mountain Man", description: "Sausage, onion, peppers, tomatoes and cheese.", priceCents: 1595 },
      { name: "Mountain Woman", description: "Bacon, onion, peppers, tomatoes and cheese.", priceCents: 1595 },
      { name: "Denver", description: "Ham, onion, peppers and cheese.", priceCents: 1595 },
      { name: "Western", description: "Bacon, onion, peppers and cheese.", priceCents: 1595 },
      { name: "Southern", description: "Sausage, onion, peppers and cheese.", priceCents: 1595 },
      { name: "Bacon, Ham, or Sausage", description: "Choice of one meat topped with cheese.", priceCents: 1495 },
      { name: "Cheese Omelet", description: "Topped with cheese.", priceCents: 1195 },
    ],
  },
  {
    name: "Pancakes & More",
    items: [
      { name: "2+2+2", description: "Two eggs, two pancakes or two French toast, two bacon strips or two sausage. Add hash browns $2.", priceCents: 1225 },
      { name: "Paul Bunyon", description: "One pancake, one French toast, half biscuit & gravy, two eggs, two bacon, one sausage, country potatoes.", priceCents: 1895 },
      { name: "Single Pancake", priceCents: 350 },
      { name: "Short Stack Pancakes (2)", priceCents: 675 },
      { name: "Full Stack Pancakes (3)", priceCents: 975 },
      { name: "Full Order French Toast", description: "3 slices.", priceCents: 875 },
      { name: "Half Order French Toast", description: "2 slices.", priceCents: 795 },
    ],
  },
  {
    name: "All American Breakfast",
    items: [
      { name: "Two Eggs", description: "Served with country potatoes and toast.", priceCents: 1150 },
      { name: "Chicken Fried Steak", description: "Two eggs, country potatoes, toast. Choice of gravy or green chili.", priceCents: 1750 },
      { name: "Sirloin Steak (6 oz Premium Cut)", description: "Two eggs, country potatoes, toast.", priceCents: 1750 },
      { name: "Corned Beef Hash", description: "Two eggs, country potatoes, toast.", priceCents: 1750 },
      { name: "Two Pork Chops", description: "Two eggs, country potatoes, toast.", priceCents: 1750 },
      { name: "Bacon Breakfast", description: "Two eggs, four slices of bacon, country potatoes, toast.", priceCents: 1575 },
      { name: "Sausage Breakfast", description: "Two eggs, two sausage patties or four links, country potatoes, toast.", priceCents: 1575 },
      { name: "Ham Steak", description: "Two eggs, country potatoes, toast.", priceCents: 1575 },
    ],
  },
  {
    name: "Biscuits & Gravy",
    items: [
      { name: "Single Biscuit & Gravy", priceCents: 700 },
      { name: "Single Biscuit & Gravy with Country Potatoes", priceCents: 800 },
      { name: "Two Biscuits & Gravy", priceCents: 900 },
      { name: "Two Biscuits & Gravy with Country Potatoes", priceCents: 1000 },
      { name: "Mass Confusion", description: "Two biscuits & gravy topped with country potatoes, two eggs, choice of ham, bacon or sausage.", priceCents: 1895 },
      { name: "Half Mass Confusion", description: "One biscuit & gravy topped with one egg, country potatoes, choice of ham, bacon or sausage.", priceCents: 1295 },
    ],
  },
  {
    name: "Square Meals",
    description: "Served on top of country potatoes with cheese, two eggs and toast.",
    items: [
      { name: "Denver Square", description: "Ham, onion, peppers and cheese.", priceCents: 1595 },
      { name: "Western Square", description: "Bacon, onion, peppers and cheese.", priceCents: 1595 },
      { name: "Southern Square", description: "Sausage, onions, peppers and cheese.", priceCents: 1595 },
      { name: "Veggie Square", description: "Onions, peppers, tomatoes, mushroom, spinach and cheese.", priceCents: 1595 },
      { name: "Three Meat Square", description: "Ham, bacon, sausage and cheese.", priceCents: 1595 },
    ],
  },
  {
    name: "Daily Specials",
    description: "Each daily special is $11.95.",
    items: [
      { name: "Special A", description: "Two eggs, two bacon strips, country potatoes, toast.", priceCents: 1195 },
      { name: "Special B", description: "Two eggs, one sausage patty or two links, country potatoes, toast.", priceCents: 1195 },
      { name: "Special C", description: "One biscuit & gravy with sausage patty.", priceCents: 1195 },
      { name: "Special D", description: "Two pancakes, two strips of bacon.", priceCents: 1195 },
      { name: "Special E", description: "Half slice of ham, two eggs, country potatoes, toast.", priceCents: 1195 },
      { name: "Special F", description: "Two slices of French toast and one sausage.", priceCents: 1195 },
      { name: "Special G", description: "Half order corned beef hash, two eggs, country potatoes, toast.", priceCents: 1195 },
      { name: "Special H", description: "One pancake or one piece French toast, one egg, one bacon or one sausage.", priceCents: 1195 },
    ],
  },
  {
    name: "Mexican Breakfast",
    items: [
      { name: "Breakfast Burrito", description: "Two eggs, country potatoes, choice of ham/bacon/sausage smothered in pork green chili and cheese.", priceCents: 1795 },
      { name: "Half Breakfast Burrito", description: "One egg, hash, country potatoes, choice of ham/bacon/sausage smothered in pork green chili and cheese.", priceCents: 1295 },
      { name: "Huevos Garcia", description: "Two eggs, country potatoes, grilled peppers, onions, tomatoes smothered in pork green chili and cheese.", priceCents: 1750 },
      { name: "Huevos Rancheros", description: "Two eggs over corn tortillas, refried beans smothered in pork green chili and cheese, country potatoes.", priceCents: 1750 },
      { name: "Two Crispy Chili Rellenos", description: "Two eggs, country potatoes, smothered in pork green chili.", priceCents: 1750 },
    ],
  },
  {
    name: "Burgers",
    description: "Served with choice of french fries, onion rings, chips, potato salad or cottage cheese.",
    items: [
      { name: "Hamburger", priceCents: 1550 },
      { name: "Cheese Burger", priceCents: 1650 },
      { name: "Bacon Cheeseburger", priceCents: 1650 },
      { name: "Patty Melt", description: "Grilled onions, Swiss cheese.", priceCents: 1750 },
      { name: "Green Chili Cheeseburger", description: "Served open face with pork green chili and cheese.", priceCents: 1750 },
      { name: "Hickory Burger", description: "Topped with barbecue sauce and Swiss cheese.", priceCents: 1750 },
      { name: "Swiss Mushroom Burger", description: "Topped with fresh grilled mushrooms and Swiss cheese.", priceCents: 1750 },
      { name: "Mexican Burger", description: "Served in a tortilla topped with pork green chili and cheese.", priceCents: 1750 },
      { name: "House Burger", description: "Topped with fresh grilled mushrooms, bacon, Swiss and American cheese.", priceCents: 1750 },
      { name: "Western Burger", description: "Topped with onion ring, bacon and cheese.", priceCents: 1750 },
      { name: "Jalapeno Burger", description: "Topped with pepper jack cheese and jalapenos.", priceCents: 1750 },
    ],
  },
  {
    name: "Sandwiches",
    description: "Served with choice of french fries, tater tots, chips, onion rings, potato salad or cottage cheese.",
    items: [
      { name: "Grilled Ham & Cheese", priceCents: 1295 },
      { name: "Club Sandwich", description: "Triple-decker sandwich served on choice of bread.", priceCents: 1695 },
      { name: "Cold Ham or Turkey Sandwich", description: "Choice of ham or turkey on choice of bread with lettuce, tomato, mayo, cheese.", priceCents: 1395 },
      { name: "Grilled Cheese", priceCents: 1095 },
      { name: "B.L.T.", description: "Bacon, lettuce, tomato, mayo on choice of bread toasted.", priceCents: 1695 },
      { name: "Colorado Melt", description: "Ham, turkey, tomato, American and Swiss cheese grilled on sourdough.", priceCents: 1695 },
    ],
  },
  {
    name: "Lunch Entrees",
    description: "Served with choice of mashed potatoes, french fries, onion rings, and a salad.",
    items: [
      { name: "Chicken Fried Steak (Lunch)", priceCents: 1750 },
      { name: "Two Pork Chops (Lunch)", priceCents: 1750 },
      { name: "Sirloin Steak (Lunch)", priceCents: 1750 },
    ],
  },
  {
    name: "Salads",
    items: [
      { name: "Chef Salad", description: "Lettuce topped with sliced ham, turkey, cheese, tomatoes and onions.", priceCents: 1150 },
      { name: "Taco Salad", description: "Lettuce, ground beef, tomatoes, cheese, pork green chili, served in a deep-fried tortilla bowl.", priceCents: 1150 },
    ],
  },
  {
    name: "Kids Breakfast",
    description: "12 and under $5.00 · 13 and up $7.95",
    items: [
      { name: "Kids #1", description: "1 egg, bacon or sausage, country potatoes, toast.", priceCents: 500 },
      { name: "Kids #2", description: "One slice French toast with sausage.", priceCents: 500 },
      { name: "Kids #3", description: "One egg, cheese omelette, toast.", priceCents: 500 },
      { name: "Kids #4", description: "Mickey Mouse pancake and bacon.", priceCents: 500 },
      { name: "Kids #5", description: "Egg in a nest with bacon or sausage.", priceCents: 500 },
    ],
  },
  {
    name: "Kids Lunch",
    description: "Served with chips or french fries.",
    items: [
      { name: "Peanut Butter & Jelly Sandwich", priceCents: 700 },
      { name: "Chicken Nuggets", priceCents: 700 },
      { name: "Grilled Cheese (Kids)", priceCents: 700 },
      { name: "Bean & Cheese Burrito", priceCents: 700 },
    ],
  },
  {
    name: "Sides",
    items: [
      { name: "Ham, Bacon or Sausage", priceCents: 775 },
      { name: "Toast", description: "White, wheat, sourdough, raisin, English muffin, or gluten-free.", priceCents: 200 },
      { name: "Single Biscuit", priceCents: 215 },
      { name: "Two Biscuits", priceCents: 325 },
      { name: "Oatmeal", description: "Served with raisins, brown sugar and milk.", priceCents: 595 },
      { name: "Green Chili or Gravy", priceCents: 395 },
      { name: "Corned Beef Hash (Side)", priceCents: 775 },
      { name: "Two Pork Chops (Side)", priceCents: 825 },
      { name: "One Egg", priceCents: 250 },
      { name: "Two Eggs (Side)", priceCents: 395 },
      { name: "Egg Whites", priceCents: 400 },
      { name: "Mashed Potatoes", priceCents: 395 },
      { name: "French Fries", priceCents: 795 },
      { name: "Chili Cheese Fries", description: "Topped with pork green chili and cheese.", priceCents: 1095 },
      { name: "Onion Rings", priceCents: 795 },
      { name: "Sliced Tomatoes", priceCents: 300 },
      { name: "Country Potatoes", priceCents: 495 },
      { name: "Sirloin Steak (6 oz Side)", priceCents: 975 },
    ],
  },
  {
    name: "Beverages",
    items: [
      { name: "Coffee / Decaf", priceCents: 299 },
      { name: "Hot Tea", priceCents: 299 },
      { name: "Iced Tea", priceCents: 299 },
      { name: "Milk", priceCents: 215 },
      { name: "Chocolate Milk", priceCents: 350 },
      { name: "Hot Chocolate", description: "Topped with whipped cream.", priceCents: 350 },
      { name: "Soda", description: "Coke, Diet Coke, Sprite, Root Beer, Orange Fanta, Dr. Pepper.", priceCents: 399 },
      { name: "Lemonade", priceCents: 299 },
      { name: "Juice (Large)", description: "Orange, apple, cranberry or tomato.", priceCents: 350 },
      { name: "Juice (Small)", description: "Orange, apple, cranberry or tomato.", priceCents: 200 },
    ],
  },
];

async function main() {
  console.log("🧹 Wiping existing data…");
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.menuItem.deleteMany();
  await db.menuCategory.deleteMany();
  await db.lead.deleteMany();
  await db.leadSearch.deleteMany();
  await db.outreachTemplate.deleteMany();
  await db.user.deleteMany();
  await db.restaurant.deleteMany();
  await db.operator.deleteMany();

  console.log("🧑‍💼 Creating bootstrap operator (Josh's agency)…");
  const operator = await db.operator.create({
    data: {
      email: "agency@platform.local",
      name: "Josh's Agency",
      businessName: "Mainpost Studio",
      areaCity: "Golden",
      areaState: "CO",
      subscriptionStatus: "active",
      subscriptionTier: "agency",
    },
  });

  console.log("🏠 Creating Mama Bears Cafe…");
  const restaurant = await db.restaurant.create({
    data: {
      slug: "mama-bears",
      name: "Mama Bears Cafe",
      tagline: "A warm, homey breakfast spot in Golden, Colorado.",
      description:
        "Hearty American breakfast, lunch favorites, and Mexican specialties — served with a side of mountain hospitality.",
      address: "15985 S Golden Rd",
      city: "Golden",
      state: "CO",
      zip: "80401",
      phone: "(720) 916-1923",
      email: "hello@mamabearscafe.example",
      hours: JSON.stringify(MAMA_BEARS_HOURS),
      primaryColor: "#C8542C",
      accentColor: "#2D5A3D",
      heroImageUrl: "/restaurants/mama-bears/hero.png",
      taxBps: 865, // 8.65% Golden, CO sales tax
      isActive: true,
      isPrimary: true,
      operatorId: operator.id,
    },
  });

  console.log("📋 Seeding menu…");
  let categoryOrder = 0;
  for (const cat of MAMA_BEARS_MENU) {
    const category = await db.menuCategory.create({
      data: {
        restaurantId: restaurant.id,
        name: cat.name,
        description: cat.description,
        displayOrder: categoryOrder++,
      },
    });
    let itemOrder = 0;
    for (const item of cat.items) {
      await db.menuItem.create({
        data: {
          restaurantId: restaurant.id,
          categoryId: category.id,
          name: item.name,
          description: item.description,
          priceCents: item.priceCents,
          displayOrder: itemOrder++,
          isAvailable: true,
        },
      });
    }
  }

  console.log("👤 Creating users…");

  // Platform super-admin — Josh as the SaaS owner. No operator/restaurant scope.
  const superAdminPass = await bcrypt.hash("super123!", 10);
  await db.user.create({
    data: {
      email: "josh@platform.local",
      passwordHash: superAdminPass,
      name: "Josh Skwarek",
      role: "super_admin",
      restaurantId: null,
      operatorId: null,
    },
  });

  // Operator-tier user — Josh's "agency operator" account, owns Mama Bears
  const operatorPass = await bcrypt.hash("operator123!", 10);
  await db.user.create({
    data: {
      email: "agency@platform.local",
      passwordHash: operatorPass,
      name: "Josh (Agency)",
      role: "operator",
      operatorId: operator.id,
    },
  });

  // Restaurant admin — Mama Bears' owner
  const restaurantAdminPass = await bcrypt.hash("mama123!", 10);
  await db.user.create({
    data: {
      email: "owner@mamabears.local",
      passwordHash: restaurantAdminPass,
      name: "Mama Bears Owner",
      role: "restaurant_admin",
      restaurantId: restaurant.id,
    },
  });

  console.log("✉️  Seeding platform-default outreach templates…");
  const templates = [
    {
      name: "Cold email — restaurant",
      kind: "email",
      appliesTo: "restaurant",
      subject: "Quick idea for {{businessName}}",
      body: `Hi there,

I'm {{operatorName}}, I build websites for local restaurants in {{city}}. I noticed {{businessName}} doesn't have a website yet — your customers are searching for you on Google but landing on listings instead of a site that shows off your menu, hours, and atmosphere.

I'd love to put a site together for you on spec — no commitment. You'd see it before paying anything. Should take me a couple days. If you like it, we can talk about what makes sense to charge.

Want me to put something together?

— {{operatorName}}
{{operatorBusinessName}}`,
    },
    {
      name: "Cold email — service business",
      kind: "email",
      appliesTo: "service_business",
      subject: "A site for {{businessName}}",
      body: `Hi,

I'm {{operatorName}} — I help local businesses in {{city}} get a clean, professional website without the agency price tag.

I noticed {{businessName}} doesn't have a site yet. People searching for {{businessType}} in the area aren't finding much about you, which means they're booking with whoever shows up first instead.

I'd build you something on spec — totally free to look at. If you like it, we figure out a fair price. If not, no harm done.

Worth a 5-minute call this week?

— {{operatorName}}
{{operatorBusinessName}}`,
    },
    {
      name: "Follow-up — gentle bump",
      kind: "email",
      subject: "Following up on {{businessName}}'s site",
      body: `Hey,

Wanted to circle back on my note from last week about putting a website together for {{businessName}}. Totally understand if you've been heads-down — small business owners are busy people.

Still happy to mock something up for you to look at. Takes me a day or two, and there's zero commitment to use it.

Just reply with a yes and I'll get started.

— {{operatorName}}`,
    },
    {
      name: "Voicemail script",
      kind: "voicemail",
      body: `Hey, this message is for {{businessName}}. My name is {{operatorName}} and I build websites for local businesses in {{city}}. I noticed you don't have a site yet and I'd love to put one together for you on spec — totally free to look at, no commitment.

Give me a call back at {{operatorPhone}} or shoot me an email. I'd love to show you what I'm thinking. Thanks, and have a great day.`,
    },
    {
      name: "Walk-in script",
      kind: "script",
      body: `Hi! Are you the owner? Great. I'm {{operatorName}} — I build websites for local businesses around {{city}}.

I was looking up {{businessName}} earlier and noticed you don't have a website yet. I'd love to mock one up for you — no charge to look at, no commitment.

If you have a card, I'll put something together this week and send you a link to see how it'd look. If you like it, we can figure out what makes sense from there.

Either way, you'd own it.`,
    },
  ];
  for (const t of templates) {
    await db.outreachTemplate.create({
      data: {
        operatorId: null, // platform-default
        name: t.name,
        kind: t.kind,
        subject: t.subject ?? null,
        body: t.body,
        appliesTo: t.appliesTo ?? null,
      },
    });
  }
  console.log(`   ${templates.length} templates seeded.`);

  const counts = await db.menuItem.count({ where: { restaurantId: restaurant.id } });
  console.log(`✅ Seed complete.`);
  console.log(`   Operator: ${operator.businessName} (${operator.email})`);
  console.log(`   Restaurant: ${restaurant.name} (slug: ${restaurant.slug})`);
  console.log(`   Menu items: ${counts}`);
  console.log(`   Super admin: josh@platform.local / super123!`);
  console.log(`   Operator: agency@platform.local / operator123!`);
  console.log(`   Restaurant admin: owner@mamabears.local / mama123!`);
}

main()
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await db.$disconnect();
    process.exit(1);
  });
