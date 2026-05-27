"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRestaurantAdmin } from "@/lib/auth";

async function ensureAuth(slug: string) {
  const res = await requireRestaurantAdmin(slug);
  if (!res.authorized) throw new Error(res.reason);
  return res;
}

// ============================================================================
// Staff (team / instructors / providers)
// ============================================================================

const StaffSchema = z.object({
  slug: z.string(),
  name: z.string().min(1).max(120),
  title: z.string().max(120).optional().nullable(),
  bio: z.string().max(2000).optional().nullable(),
  specialties: z.array(z.string().max(80)).max(20).optional(),
  bookingUrl: z.string().url().optional().or(z.literal("")).nullable(),
  instagram: z.string().max(200).optional().nullable(),
  yearsExperience: z.number().int().min(0).max(100).optional().nullable(),
  photoUrl: z.string().max(500).optional().nullable(),
});

export async function createStaff(input: z.infer<typeof StaffSchema>) {
  const data = StaffSchema.parse(input);
  const { restaurant } = await ensureAuth(data.slug);
  const max = await db.staff.aggregate({
    where: { restaurantId: restaurant.id },
    _max: { displayOrder: true },
  });
  const order = (max._max.displayOrder ?? -1) + 1;
  const staff = await db.staff.create({
    data: {
      restaurantId: restaurant.id,
      name: data.name,
      title: data.title ?? null,
      bio: data.bio ?? null,
      specialties: JSON.stringify(data.specialties ?? []),
      bookingUrl: data.bookingUrl || null,
      instagram: data.instagram ?? null,
      yearsExperience: data.yearsExperience ?? null,
      photoUrl: data.photoUrl ?? null,
      displayOrder: order,
    },
  });
  revalidatePath(`/r/${data.slug}/admin/team`);
  revalidatePath(`/r/${data.slug}`);
  return { ok: true as const, staff };
}

const UpdateStaffSchema = StaffSchema.extend({ id: z.string() }).partial({
  name: true,
});

export async function updateStaff(input: z.infer<typeof UpdateStaffSchema>) {
  const data = UpdateStaffSchema.parse(input);
  if (!data.id) return { ok: false as const, error: "id required" };
  const { restaurant } = await ensureAuth(data.slug);
  const existing = await db.staff.findUnique({ where: { id: data.id } });
  if (!existing || existing.restaurantId !== restaurant.id) {
    return { ok: false as const, error: "Staff not found" };
  }
  await db.staff.update({
    where: { id: data.id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.title !== undefined && { title: data.title ?? null }),
      ...(data.bio !== undefined && { bio: data.bio ?? null }),
      ...(data.specialties !== undefined && {
        specialties: JSON.stringify(data.specialties),
      }),
      ...(data.bookingUrl !== undefined && {
        bookingUrl: data.bookingUrl || null,
      }),
      ...(data.instagram !== undefined && { instagram: data.instagram ?? null }),
      ...(data.yearsExperience !== undefined && {
        yearsExperience: data.yearsExperience ?? null,
      }),
      ...(data.photoUrl !== undefined && { photoUrl: data.photoUrl ?? null }),
    },
  });
  revalidatePath(`/r/${data.slug}/admin/team`);
  revalidatePath(`/r/${data.slug}`);
  return { ok: true as const };
}

export async function deleteStaff(input: { slug: string; id: string }) {
  const { slug, id } = z
    .object({ slug: z.string(), id: z.string() })
    .parse(input);
  const { restaurant } = await ensureAuth(slug);
  const existing = await db.staff.findUnique({ where: { id } });
  if (!existing || existing.restaurantId !== restaurant.id) {
    return { ok: false as const, error: "Staff not found" };
  }
  await db.staff.delete({ where: { id } });
  revalidatePath(`/r/${slug}/admin/team`);
  revalidatePath(`/r/${slug}`);
  return { ok: true as const };
}

// ============================================================================
// ClassSession (recurring gym/fitness/yoga schedule)
// ============================================================================

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

const ClassSchema = z.object({
  slug: z.string(),
  name: z.string().min(1).max(120),
  description: z.string().max(600).optional().nullable(),
  dayOfWeek: z.enum(DAYS),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  instructorId: z.string().optional().nullable(),
  capacity: z.number().int().min(0).max(500).optional().nullable(),
  level: z.string().max(40).optional().nullable(),
  bookingUrl: z.string().url().optional().or(z.literal("")).nullable(),
});

export async function createClassSession(input: z.infer<typeof ClassSchema>) {
  const data = ClassSchema.parse(input);
  const { restaurant } = await ensureAuth(data.slug);
  const cls = await db.classSession.create({
    data: {
      restaurantId: restaurant.id,
      name: data.name,
      description: data.description ?? null,
      dayOfWeek: data.dayOfWeek,
      startTime: data.startTime,
      endTime: data.endTime,
      instructorId: data.instructorId ?? null,
      capacity: data.capacity ?? null,
      level: data.level ?? null,
      bookingUrl: data.bookingUrl || null,
    },
  });
  revalidatePath(`/r/${data.slug}/admin/classes`);
  revalidatePath(`/r/${data.slug}`);
  return { ok: true as const, cls };
}

const UpdateClassSchema = ClassSchema.extend({ id: z.string() }).partial({
  name: true,
  dayOfWeek: true,
  startTime: true,
  endTime: true,
});

export async function updateClassSession(input: z.infer<typeof UpdateClassSchema>) {
  const data = UpdateClassSchema.parse(input);
  if (!data.id) return { ok: false as const, error: "id required" };
  const { restaurant } = await ensureAuth(data.slug);
  const existing = await db.classSession.findUnique({ where: { id: data.id } });
  if (!existing || existing.restaurantId !== restaurant.id) {
    return { ok: false as const, error: "Class not found" };
  }
  await db.classSession.update({
    where: { id: data.id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && {
        description: data.description ?? null,
      }),
      ...(data.dayOfWeek !== undefined && { dayOfWeek: data.dayOfWeek }),
      ...(data.startTime !== undefined && { startTime: data.startTime }),
      ...(data.endTime !== undefined && { endTime: data.endTime }),
      ...(data.instructorId !== undefined && {
        instructorId: data.instructorId ?? null,
      }),
      ...(data.capacity !== undefined && { capacity: data.capacity ?? null }),
      ...(data.level !== undefined && { level: data.level ?? null }),
      ...(data.bookingUrl !== undefined && {
        bookingUrl: data.bookingUrl || null,
      }),
    },
  });
  revalidatePath(`/r/${data.slug}/admin/classes`);
  revalidatePath(`/r/${data.slug}`);
  return { ok: true as const };
}

export async function deleteClassSession(input: { slug: string; id: string }) {
  const { slug, id } = z
    .object({ slug: z.string(), id: z.string() })
    .parse(input);
  const { restaurant } = await ensureAuth(slug);
  const existing = await db.classSession.findUnique({ where: { id } });
  if (!existing || existing.restaurantId !== restaurant.id) {
    return { ok: false as const, error: "Class not found" };
  }
  await db.classSession.delete({ where: { id } });
  revalidatePath(`/r/${slug}/admin/classes`);
  revalidatePath(`/r/${slug}`);
  return { ok: true as const };
}

// ============================================================================
// Testimonial
// ============================================================================

const TestimonialSchema = z.object({
  slug: z.string(),
  quote: z.string().min(1).max(2000),
  author: z.string().max(120).optional().nullable(),
  rating: z.number().int().min(1).max(5).optional().nullable(),
  source: z.string().max(40).default("manual"),
});

export async function createTestimonial(input: z.infer<typeof TestimonialSchema>) {
  const data = TestimonialSchema.parse(input);
  const { restaurant } = await ensureAuth(data.slug);
  const max = await db.testimonial.aggregate({
    where: { restaurantId: restaurant.id },
    _max: { displayOrder: true },
  });
  const order = (max._max.displayOrder ?? -1) + 1;
  const t = await db.testimonial.create({
    data: {
      restaurantId: restaurant.id,
      quote: data.quote,
      author: data.author ?? null,
      rating: data.rating ?? null,
      source: data.source ?? "manual",
      displayOrder: order,
    },
  });
  revalidatePath(`/r/${data.slug}/admin/testimonials`);
  revalidatePath(`/r/${data.slug}`);
  return { ok: true as const, t };
}

export async function deleteTestimonial(input: { slug: string; id: string }) {
  const { slug, id } = z
    .object({ slug: z.string(), id: z.string() })
    .parse(input);
  const { restaurant } = await ensureAuth(slug);
  const existing = await db.testimonial.findUnique({ where: { id } });
  if (!existing || existing.restaurantId !== restaurant.id) {
    return { ok: false as const, error: "Testimonial not found" };
  }
  await db.testimonial.delete({ where: { id } });
  revalidatePath(`/r/${slug}/admin/testimonials`);
  revalidatePath(`/r/${slug}`);
  return { ok: true as const };
}

// ============================================================================
// GalleryImage
// ============================================================================

const GalleryAddSchema = z.object({
  slug: z.string(),
  imageUrl: z.string().max(500).min(1),
  caption: z.string().max(280).optional().nullable(),
  tag: z.string().max(80).optional().nullable(),
});

export async function addGalleryImage(input: z.infer<typeof GalleryAddSchema>) {
  const data = GalleryAddSchema.parse(input);
  const { restaurant } = await ensureAuth(data.slug);
  const max = await db.galleryImage.aggregate({
    where: { restaurantId: restaurant.id },
    _max: { displayOrder: true },
  });
  const order = (max._max.displayOrder ?? -1) + 1;
  const g = await db.galleryImage.create({
    data: {
      restaurantId: restaurant.id,
      imageUrl: data.imageUrl,
      caption: data.caption ?? null,
      tag: data.tag ?? null,
      displayOrder: order,
    },
  });
  revalidatePath(`/r/${data.slug}/admin/gallery`);
  revalidatePath(`/r/${data.slug}`);
  return { ok: true as const, g };
}

export async function deleteGalleryImage(input: { slug: string; id: string }) {
  const { slug, id } = z
    .object({ slug: z.string(), id: z.string() })
    .parse(input);
  const { restaurant } = await ensureAuth(slug);
  const existing = await db.galleryImage.findUnique({ where: { id } });
  if (!existing || existing.restaurantId !== restaurant.id) {
    return { ok: false as const, error: "Image not found" };
  }
  // Soft delete only the row — leave the file in storage (operator may still use)
  await db.galleryImage.delete({ where: { id } });
  revalidatePath(`/r/${slug}/admin/gallery`);
  revalidatePath(`/r/${slug}`);
  return { ok: true as const };
}

// ============================================================================
// FAQ
// ============================================================================

const FaqSchema = z.object({
  slug: z.string(),
  question: z.string().min(1).max(280),
  answer: z.string().min(1).max(2000),
});

export async function createFaq(input: z.infer<typeof FaqSchema>) {
  const data = FaqSchema.parse(input);
  const { restaurant } = await ensureAuth(data.slug);
  const max = await db.faq.aggregate({
    where: { restaurantId: restaurant.id },
    _max: { displayOrder: true },
  });
  const f = await db.faq.create({
    data: {
      restaurantId: restaurant.id,
      question: data.question,
      answer: data.answer,
      displayOrder: (max._max.displayOrder ?? -1) + 1,
    },
  });
  revalidatePath(`/r/${data.slug}/admin/faqs`);
  revalidatePath(`/r/${data.slug}`);
  return { ok: true as const, f };
}

export async function deleteFaq(input: { slug: string; id: string }) {
  const { slug, id } = z
    .object({ slug: z.string(), id: z.string() })
    .parse(input);
  const { restaurant } = await ensureAuth(slug);
  const existing = await db.faq.findUnique({ where: { id } });
  if (!existing || existing.restaurantId !== restaurant.id) {
    return { ok: false as const, error: "FAQ not found" };
  }
  await db.faq.delete({ where: { id } });
  revalidatePath(`/r/${slug}/admin/faqs`);
  revalidatePath(`/r/${slug}`);
  return { ok: true as const };
}

// ============================================================================
// Upload helper for Staff photos
// ============================================================================

export async function uploadStaffPhoto(formData: FormData): Promise<{
  ok: boolean;
  imageUrl?: string;
  error?: string;
}> {
  const slug = formData.get("slug");
  const file = formData.get("file");
  if (typeof slug !== "string" || !(file instanceof File)) {
    return { ok: false, error: "Bad request" };
  }
  await ensureAuth(slug);
  try {
    const { uploadImage, UploadError } = await import("@/lib/upload");
    const url = await uploadImage(slug, file, "items");
    return { ok: true, imageUrl: url };
  } catch (e) {
    const { UploadError } = await import("@/lib/upload");
    if (e instanceof UploadError) return { ok: false, error: e.message };
    console.error("[uploadStaffPhoto]", e);
    return { ok: false, error: "Upload failed" };
  }
}
