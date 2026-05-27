// Auto-populate engine — takes a merged ExtractedSite and a restaurant
// row, and creates rows in the vertical tables (Staff, Testimonial, Faq,
// GalleryImage) + writes JSON services + imports menu items.
//
// Behaviors:
//   - skip-if-exists: never duplicates Staff by name, Testimonial by
//     quote-prefix, Faq by question, Gallery by source URL
//   - text-field merge: only fills BLANK Restaurant fields
//     (tagline/about/address/phone/email) — never overwrites operator edits
//   - photo ingestion: downloads each scraped photo, uploads via uploadImage,
//     creates GalleryImage row
//   - menu import: leverages applyExtractedMenu (append mode) so existing
//     menu isn't wiped
//
// Returns a structured summary the UI can show as a result card.

import { db } from "./db";
import {
  ingestScrapedPhotoAsAsset,
  ingestScrapedPhotos,
} from "./scraped-photos";
import type { ExtractedSite } from "./auto-scrape";
import { type BusinessType } from "./business-types";

const MAX_PHOTOS_INGEST = 16;
const MAX_STAFF_INGEST = 12;
const MAX_TESTIMONIALS_INGEST = 12;
const MAX_FAQS_INGEST = 10;

export interface PopulateOptions {
  /** When true, also use the first photo as the hero (only if hero is blank). */
  setHeroIfMissing?: boolean;
}

export interface PopulateResult {
  fieldsUpdated: string[];
  heroSet: boolean;
  servicesSet: number;
  staffCreated: number;
  staffSkipped: number;
  testimonialsCreated: number;
  testimonialsSkipped: number;
  faqsCreated: number;
  faqsSkipped: number;
  galleryCreated: number;
  galleryFailed: number;
  menuCategoriesCreated: number;
  menuItemsCreated: number;
}

export async function autoPopulateRestaurant(args: {
  restaurantId: string;
  slug: string;
  site: ExtractedSite;
  businessType: BusinessType;
  opts?: PopulateOptions;
}): Promise<PopulateResult> {
  const { restaurantId, slug, site, businessType } = args;
  const opts = args.opts ?? {};

  const summary: PopulateResult = {
    fieldsUpdated: [],
    heroSet: false,
    servicesSet: 0,
    staffCreated: 0,
    staffSkipped: 0,
    testimonialsCreated: 0,
    testimonialsSkipped: 0,
    faqsCreated: 0,
    faqsSkipped: 0,
    galleryCreated: 0,
    galleryFailed: 0,
    menuCategoriesCreated: 0,
    menuItemsCreated: 0,
  };

  const restaurant = await db.restaurant.findUnique({ where: { id: restaurantId } });
  if (!restaurant) throw new Error(`Restaurant not found: ${restaurantId}`);

  // ---- Text fields (only fill blanks) ----
  const updates: Record<string, string | null> = {};
  if (!restaurant.tagline && site.tagline?.trim()) {
    updates.tagline = site.tagline.trim();
    summary.fieldsUpdated.push("tagline");
  }
  if (!restaurant.aboutCopy && site.about?.trim()) {
    updates.aboutCopy = site.about.trim();
    summary.fieldsUpdated.push("aboutCopy");
  }
  if (!restaurant.email && site.email?.trim()) {
    updates.email = site.email.trim();
    summary.fieldsUpdated.push("email");
  }
  // Phone + address are usually set at create-time; only fill if blank
  if (!restaurant.address && site.address?.trim()) {
    updates.address = site.address.trim();
    summary.fieldsUpdated.push("address");
  }
  if (Object.keys(updates).length > 0) {
    await db.restaurant.update({ where: { id: restaurantId }, data: updates });
  }

  // ---- Services list (Restaurant.services JSON) ----
  // For restaurant-type businesses, we use menu items not services. For all
  // others, write the services JSON IF empty.
  if (businessType !== "restaurant" && (!restaurant.services || restaurant.services === "[]" || restaurant.services === "null")) {
    if (site.services && site.services.length > 0) {
      const services = site.services.slice(0, 15).map((s, i) => ({
        id: `auto-${Date.now()}-${i}`,
        name: s.name,
        description: s.description ?? undefined,
        priceCents: s.priceCents ?? null,
        duration: s.duration ?? null,
      }));
      await db.restaurant.update({
        where: { id: restaurantId },
        data: { services: JSON.stringify(services) },
      });
      summary.servicesSet = services.length;
    }
  }

  // ---- Staff ----
  if (site.staff && site.staff.length > 0) {
    const existing = await db.staff.findMany({
      where: { restaurantId },
      select: { name: true },
    });
    const existingNames = new Set(existing.map((s) => s.name.toLowerCase()));
    const startOrder = (
      await db.staff.aggregate({
        where: { restaurantId },
        _max: { displayOrder: true },
      })
    )._max.displayOrder ?? -1;
    let nextOrder = startOrder + 1;
    for (const s of site.staff.slice(0, MAX_STAFF_INGEST)) {
      const key = s.name.trim().toLowerCase();
      if (!key) continue;
      if (existingNames.has(key)) {
        summary.staffSkipped++;
        continue;
      }
      try {
        await db.staff.create({
          data: {
            restaurantId,
            name: s.name.trim(),
            title: s.title?.trim() || null,
            bio: s.bio?.trim() || null,
            specialties: JSON.stringify(s.specialties ?? []),
            displayOrder: nextOrder++,
          },
        });
        summary.staffCreated++;
      } catch (e) {
        console.warn("[autoPopulate] staff create failed:", e);
        summary.staffSkipped++;
      }
    }
  }

  // ---- Testimonials ----
  if (site.testimonials && site.testimonials.length > 0) {
    const existing = await db.testimonial.findMany({
      where: { restaurantId },
      select: { quote: true },
    });
    const existingKeys = new Set(
      existing.map((t) => t.quote.slice(0, 80).toLowerCase())
    );
    const startOrder = (
      await db.testimonial.aggregate({
        where: { restaurantId },
        _max: { displayOrder: true },
      })
    )._max.displayOrder ?? -1;
    let nextOrder = startOrder + 1;
    for (const t of site.testimonials.slice(0, MAX_TESTIMONIALS_INGEST)) {
      const quote = t.quote.trim();
      if (!quote) continue;
      const key = quote.slice(0, 80).toLowerCase();
      if (existingKeys.has(key)) {
        summary.testimonialsSkipped++;
        continue;
      }
      try {
        await db.testimonial.create({
          data: {
            restaurantId,
            quote,
            author: t.author?.trim() || null,
            rating: t.rating ?? null,
            source: "scraped",
            displayOrder: nextOrder++,
          },
        });
        summary.testimonialsCreated++;
        existingKeys.add(key);
      } catch (e) {
        console.warn("[autoPopulate] testimonial create failed:", e);
        summary.testimonialsSkipped++;
      }
    }
  }

  // ---- FAQs ----
  if (site.faqs && site.faqs.length > 0) {
    const existing = await db.faq.findMany({
      where: { restaurantId },
      select: { question: true },
    });
    const existingKeys = new Set(existing.map((f) => f.question.toLowerCase()));
    const startOrder = (
      await db.faq.aggregate({
        where: { restaurantId },
        _max: { displayOrder: true },
      })
    )._max.displayOrder ?? -1;
    let nextOrder = startOrder + 1;
    for (const f of site.faqs.slice(0, MAX_FAQS_INGEST)) {
      const q = f.question.trim();
      const a = f.answer.trim();
      if (!q || !a) continue;
      if (existingKeys.has(q.toLowerCase())) {
        summary.faqsSkipped++;
        continue;
      }
      try {
        await db.faq.create({
          data: {
            restaurantId,
            question: q,
            answer: a,
            displayOrder: nextOrder++,
          },
        });
        summary.faqsCreated++;
        existingKeys.add(q.toLowerCase());
      } catch (e) {
        console.warn("[autoPopulate] faq create failed:", e);
      }
    }
  }

  // ---- Hero image ----
  if (opts.setHeroIfMissing && !restaurant.heroImageUrl && site.photos.length > 0) {
    // Use the same hero-candidate heuristic as the manual flow
    const heroCandidate = pickHeroCandidate(site.photos);
    if (heroCandidate) {
      try {
        const heroUrl = await ingestScrapedPhotoAsAsset(slug, heroCandidate, "hero");
        if (heroUrl) {
          await db.restaurant.update({
            where: { id: restaurantId },
            data: { heroImageUrl: heroUrl },
          });
          summary.heroSet = true;
        }
      } catch (e) {
        console.warn("[autoPopulate] hero ingest failed:", e);
      }
    }
  }

  // ---- Gallery photos ----
  if (site.photos.length > 0) {
    const existingGallery = await db.galleryImage.findMany({
      where: { restaurantId },
      select: { imageUrl: true },
    });
    const existingUrls = new Set(existingGallery.map((g) => g.imageUrl));

    // Skip the hero candidate (already used)
    const heroCandidate = opts.setHeroIfMissing
      ? pickHeroCandidate(site.photos)
      : null;
    const candidates = site.photos
      .filter((p) => p !== heroCandidate)
      .slice(0, MAX_PHOTOS_INGEST);

    const startOrder = (
      await db.galleryImage.aggregate({
        where: { restaurantId },
        _max: { displayOrder: true },
      })
    )._max.displayOrder ?? -1;
    let nextOrder = startOrder + 1;

    // Ingest each photo, creating a GalleryImage row pointing to the
    // uploaded URL (not the scraped source URL — those can go offline).
    for (const sourceUrl of candidates) {
      try {
        const stored = await ingestScrapedPhotos(slug, [sourceUrl], "items", 1);
        if (stored.length === 0) {
          summary.galleryFailed++;
          continue;
        }
        const newUrl = stored[0];
        if (existingUrls.has(newUrl)) continue;
        await db.galleryImage.create({
          data: {
            restaurantId,
            imageUrl: newUrl,
            tag: null,
            displayOrder: nextOrder++,
          },
        });
        existingUrls.add(newUrl);
        summary.galleryCreated++;
      } catch (e) {
        console.warn("[autoPopulate] gallery item failed:", e);
        summary.galleryFailed++;
      }
    }
  }

  // ---- Menu (restaurants only) ----
  if (
    businessType === "restaurant" &&
    site.menuCategories &&
    site.menuCategories.length > 0
  ) {
    const startOrder = (
      await db.menuCategory.aggregate({
        where: { restaurantId },
        _max: { displayOrder: true },
      })
    )._max.displayOrder ?? -1;
    let nextCatOrder = startOrder + 1;

    // Don't duplicate categories by name
    const existing = await db.menuCategory.findMany({
      where: { restaurantId },
      include: { items: { select: { name: true } } },
    });
    const existingCatNames = new Map(
      existing.map((c) => [
        c.name.toLowerCase(),
        new Set(c.items.map((i) => i.name.toLowerCase())),
      ])
    );

    for (const cat of site.menuCategories) {
      const catKey = cat.name.trim().toLowerCase();
      let categoryId: string;
      let itemNames: Set<string>;
      const existingItems = existingCatNames.get(catKey);
      if (existingItems) {
        // Find the existing category by name to append items into
        const found = existing.find((c) => c.name.toLowerCase() === catKey);
        if (!found) continue;
        categoryId = found.id;
        itemNames = existingItems;
      } else {
        const c = await db.menuCategory.create({
          data: {
            restaurantId,
            name: cat.name.trim(),
            description: null,
            displayOrder: nextCatOrder++,
          },
        });
        categoryId = c.id;
        itemNames = new Set();
        summary.menuCategoriesCreated++;
        existingCatNames.set(catKey, itemNames);
      }
      let itemOrder = 0;
      for (const item of cat.items) {
        const k = item.name.trim().toLowerCase();
        if (!k || itemNames.has(k)) continue;
        try {
          await db.menuItem.create({
            data: {
              restaurantId,
              categoryId,
              name: item.name.trim(),
              description: item.description?.trim() || null,
              priceCents: item.priceCents ?? 0,
              isAvailable: true,
              displayOrder: itemOrder++,
            },
          });
          itemNames.add(k);
          summary.menuItemsCreated++;
        } catch (e) {
          console.warn("[autoPopulate] menu item failed:", e);
        }
      }
    }
  }

  return summary;
}

function pickHeroCandidate(urls: string[]): string | null {
  if (urls.length === 0) return null;
  const score = (u: string): number => {
    let s = 0;
    const lower = u.toLowerCase();
    if (/hero|banner|cover|og[-_]?image|main/.test(lower)) s += 100;
    if (/header|landing|home/.test(lower)) s += 30;
    if (/thumb|icon|favicon|logo|avatar|profile/.test(lower)) s -= 80;
    if (/-\d{3,4}x\d{3,4}\./.test(lower)) s += 20;
    if (/\.(jpe?g|png|webp|avif)(\?|$)/i.test(lower)) s += 5;
    return s;
  };
  return [...urls].sort((a, b) => score(b) - score(a))[0] ?? null;
}
