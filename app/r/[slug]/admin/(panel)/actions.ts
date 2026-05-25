"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { logoutUser, requireRestaurantAdmin } from "@/lib/auth";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/order-status";
import { emitOrderEvent } from "@/lib/order-events";
import { UploadError, deleteImage, uploadImage } from "@/lib/upload";

async function ensureAuth(slug: string) {
  const res = await requireRestaurantAdmin(slug);
  if (!res.authorized) throw new Error(res.reason);
  return res;
}

// ---------- Orders ----------

const UpdateOrderStatusSchema = z.object({
  slug: z.string(),
  orderId: z.string(),
  status: z.enum(ORDER_STATUSES),
});

export async function updateOrderStatus(input: z.infer<typeof UpdateOrderStatusSchema>) {
  const { slug, orderId, status } = UpdateOrderStatusSchema.parse(input);
  const { restaurant } = await ensureAuth(slug);

  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order || order.restaurantId !== restaurant.id) {
    return { ok: false as const, error: "Order not found" };
  }

  const updated = await db.order.update({
    where: { id: orderId },
    data: { status, updatedAt: new Date() },
  });
  emitOrderEvent({
    kind: "updated",
    restaurantId: restaurant.id,
    orderId: updated.id,
    orderNumber: updated.orderNumber,
    status: updated.status,
    ts: Date.now(),
  });
  revalidatePath(`/r/${slug}/admin`);
  revalidatePath(`/r/${slug}/admin/orders`);
  revalidatePath(`/r/${slug}/admin/orders/${orderId}`);
  revalidatePath(`/r/${slug}/order/${orderId}`);
  return { ok: true as const, status: status as OrderStatus };
}

// ---------- Menu Items ----------

const ItemSchema = z.object({
  slug: z.string(),
  categoryId: z.string(),
  name: z.string().min(1, "Name required").max(120),
  description: z.string().max(500).optional().nullable(),
  priceCents: z.number().int().min(0).max(100_000),
  isAvailable: z.boolean().default(true),
});

export async function createMenuItem(input: z.infer<typeof ItemSchema>) {
  const data = ItemSchema.parse(input);
  const { restaurant } = await ensureAuth(data.slug);

  const cat = await db.menuCategory.findUnique({ where: { id: data.categoryId } });
  if (!cat || cat.restaurantId !== restaurant.id) {
    return { ok: false as const, error: "Category not found" };
  }
  const max = await db.menuItem.aggregate({
    where: { categoryId: data.categoryId },
    _max: { displayOrder: true },
  });
  const order = (max._max.displayOrder ?? -1) + 1;

  const item = await db.menuItem.create({
    data: {
      restaurantId: restaurant.id,
      categoryId: data.categoryId,
      name: data.name,
      description: data.description ?? null,
      priceCents: data.priceCents,
      isAvailable: data.isAvailable,
      displayOrder: order,
    },
  });
  revalidatePath(`/r/${data.slug}/admin/menu`);
  revalidatePath(`/r/${data.slug}/menu`);
  return { ok: true as const, item };
}

const UpdateItemSchema = ItemSchema.partial({
  categoryId: true,
  name: true,
  priceCents: true,
  isAvailable: true,
}).extend({
  id: z.string(),
});

export async function updateMenuItem(input: z.infer<typeof UpdateItemSchema>) {
  const data = UpdateItemSchema.parse(input);
  const { restaurant } = await ensureAuth(data.slug);

  const existing = await db.menuItem.findUnique({ where: { id: data.id } });
  if (!existing || existing.restaurantId !== restaurant.id) {
    return { ok: false as const, error: "Item not found" };
  }

  await db.menuItem.update({
    where: { id: data.id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description ?? null }),
      ...(data.priceCents !== undefined && { priceCents: data.priceCents }),
      ...(data.isAvailable !== undefined && { isAvailable: data.isAvailable }),
      ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
    },
  });
  revalidatePath(`/r/${data.slug}/admin/menu`);
  revalidatePath(`/r/${data.slug}/menu`);
  return { ok: true as const };
}

export async function deleteMenuItem(input: { slug: string; id: string }) {
  const { slug, id } = z.object({ slug: z.string(), id: z.string() }).parse(input);
  const { restaurant } = await ensureAuth(slug);
  const existing = await db.menuItem.findUnique({ where: { id } });
  if (!existing || existing.restaurantId !== restaurant.id) {
    return { ok: false as const, error: "Item not found" };
  }
  if (existing.imageUrl) {
    await deleteImage(existing.imageUrl);
  }
  await db.menuItem.delete({ where: { id } });
  revalidatePath(`/r/${slug}/admin/menu`);
  revalidatePath(`/r/${slug}/menu`);
  return { ok: true as const };
}

// ---------- Menu Item Images ----------

export async function uploadMenuItemImage(formData: FormData): Promise<{
  ok: boolean;
  imageUrl?: string;
  error?: string;
}> {
  const slug = formData.get("slug");
  const itemId = formData.get("itemId");
  const file = formData.get("file");
  if (typeof slug !== "string" || typeof itemId !== "string" || !(file instanceof File)) {
    return { ok: false, error: "Bad request" };
  }
  const { restaurant } = await ensureAuth(slug);
  const existing = await db.menuItem.findUnique({ where: { id: itemId } });
  if (!existing || existing.restaurantId !== restaurant.id) {
    return { ok: false, error: "Item not found" };
  }

  try {
    const url = await uploadImage(slug, file, "items");
    // Delete the previous image if one was set
    if (existing.imageUrl) {
      await deleteImage(existing.imageUrl);
    }
    await db.menuItem.update({
      where: { id: itemId },
      data: { imageUrl: url },
    });
    revalidatePath(`/r/${slug}/admin/menu`);
    revalidatePath(`/r/${slug}/menu`);
    return { ok: true, imageUrl: url };
  } catch (e) {
    if (e instanceof UploadError) return { ok: false, error: e.message };
    console.error("[uploadMenuItemImage]", e);
    return { ok: false, error: "Upload failed. Please try again." };
  }
}

export async function removeMenuItemImage(input: { slug: string; id: string }) {
  const { slug, id } = z.object({ slug: z.string(), id: z.string() }).parse(input);
  const { restaurant } = await ensureAuth(slug);
  const existing = await db.menuItem.findUnique({ where: { id } });
  if (!existing || existing.restaurantId !== restaurant.id) {
    return { ok: false as const, error: "Item not found" };
  }
  if (existing.imageUrl) {
    await deleteImage(existing.imageUrl);
  }
  await db.menuItem.update({ where: { id }, data: { imageUrl: null } });
  revalidatePath(`/r/${slug}/admin/menu`);
  revalidatePath(`/r/${slug}/menu`);
  return { ok: true as const };
}

// ---------- Categories ----------

const CategorySchema = z.object({
  slug: z.string(),
  name: z.string().min(1).max(80),
  description: z.string().max(280).optional().nullable(),
});

export async function createCategory(input: z.infer<typeof CategorySchema>) {
  const data = CategorySchema.parse(input);
  const { restaurant } = await ensureAuth(data.slug);
  const max = await db.menuCategory.aggregate({
    where: { restaurantId: restaurant.id },
    _max: { displayOrder: true },
  });
  const order = (max._max.displayOrder ?? -1) + 1;
  const cat = await db.menuCategory.create({
    data: {
      restaurantId: restaurant.id,
      name: data.name,
      description: data.description ?? null,
      displayOrder: order,
    },
  });
  revalidatePath(`/r/${data.slug}/admin/menu`);
  revalidatePath(`/r/${data.slug}/menu`);
  return { ok: true as const, category: cat };
}

const UpdateCategorySchema = CategorySchema.extend({ id: z.string() }).partial({
  name: true,
});

export async function updateCategory(input: z.infer<typeof UpdateCategorySchema>) {
  const data = UpdateCategorySchema.parse(input);
  const { restaurant } = await ensureAuth(data.slug);
  const existing = await db.menuCategory.findUnique({ where: { id: data.id } });
  if (!existing || existing.restaurantId !== restaurant.id) {
    return { ok: false as const, error: "Category not found" };
  }
  await db.menuCategory.update({
    where: { id: data.id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description ?? null }),
    },
  });
  revalidatePath(`/r/${data.slug}/admin/menu`);
  revalidatePath(`/r/${data.slug}/menu`);
  return { ok: true as const };
}

export async function deleteCategory(input: { slug: string; id: string }) {
  const { slug, id } = z.object({ slug: z.string(), id: z.string() }).parse(input);
  const { restaurant } = await ensureAuth(slug);
  const existing = await db.menuCategory.findUnique({
    where: { id },
    include: { _count: { select: { items: true } } },
  });
  if (!existing || existing.restaurantId !== restaurant.id) {
    return { ok: false as const, error: "Category not found" };
  }
  if (existing._count.items > 0) {
    return {
      ok: false as const,
      error: `Move or delete the ${existing._count.items} item(s) in this category first.`,
    };
  }
  await db.menuCategory.delete({ where: { id } });
  revalidatePath(`/r/${slug}/admin/menu`);
  revalidatePath(`/r/${slug}/menu`);
  return { ok: true as const };
}

// ---------- Settings ----------

const SettingsSchema = z.object({
  slug: z.string(),
  name: z.string().min(1).max(120),
  tagline: z.string().max(180).optional().nullable(),
  description: z.string().max(800).optional().nullable(),
  address: z.string().min(1).max(200),
  city: z.string().max(80).optional().nullable(),
  state: z.string().max(40).optional().nullable(),
  zip: z.string().max(20).optional().nullable(),
  phone: z.string().min(1).max(40),
  email: z.string().email().max(120).optional().or(z.literal("")).nullable(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-char hex color"),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-char hex color"),
  taxBps: z.number().int().min(0).max(2000),
  hours: z.string(), // JSON string
});

export async function updateSettings(input: z.infer<typeof SettingsSchema>) {
  const data = SettingsSchema.parse(input);
  const { restaurant } = await ensureAuth(data.slug);
  await db.restaurant.update({
    where: { id: restaurant.id },
    data: {
      name: data.name,
      tagline: data.tagline ?? null,
      description: data.description ?? null,
      address: data.address,
      city: data.city ?? null,
      state: data.state ?? null,
      zip: data.zip ?? null,
      phone: data.phone,
      email: data.email || null,
      primaryColor: data.primaryColor,
      accentColor: data.accentColor,
      taxBps: data.taxBps,
      hours: data.hours,
    },
  });
  revalidatePath(`/r/${data.slug}`);
  revalidatePath(`/r/${data.slug}/menu`);
  revalidatePath(`/r/${data.slug}/admin/settings`);
  return { ok: true as const };
}

// ---------- Services (for service_business clients) ----------

const ServiceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  priceCents: z.number().int().min(0).max(10_000_00).nullable().optional(),
  duration: z.string().max(40).nullable().optional(),
});

const UpdateServicesSchema = z.object({
  slug: z.string(),
  services: z.array(ServiceSchema),
});

export async function updateServices(input: z.infer<typeof UpdateServicesSchema>) {
  const data = UpdateServicesSchema.parse(input);
  const { restaurant } = await ensureAuth(data.slug);
  await db.restaurant.update({
    where: { id: restaurant.id },
    data: { services: JSON.stringify(data.services) },
  });
  revalidatePath(`/r/${data.slug}`);
  revalidatePath(`/r/${data.slug}/admin/services`);
  return { ok: true as const };
}

// ---------- Website Template ----------

const TemplateSchema = z.object({
  slug: z.string(),
  templateId: z.enum(["modern", "classic"]),
});

export async function setRestaurantTemplate(input: z.infer<typeof TemplateSchema>) {
  const { slug, templateId } = TemplateSchema.parse(input);
  const { restaurant } = await ensureAuth(slug);
  await db.restaurant.update({
    where: { id: restaurant.id },
    data: { templateId },
  });
  revalidatePath(`/r/${slug}`);
  revalidatePath(`/r/${slug}/menu`);
  revalidatePath(`/r/${slug}/admin/settings`);
  return { ok: true as const };
}

// ---------- Online Ordering Controls ----------

export async function setOrderingPaused(input: { slug: string; paused: boolean }) {
  const { slug, paused } = z
    .object({ slug: z.string(), paused: z.boolean() })
    .parse(input);
  const { restaurant } = await ensureAuth(slug);
  await db.restaurant.update({
    where: { id: restaurant.id },
    data: { isOrderingPaused: paused },
  });
  revalidatePath(`/r/${slug}`);
  revalidatePath(`/r/${slug}/menu`);
  revalidatePath(`/r/${slug}/checkout`);
  revalidatePath(`/r/${slug}/admin/settings`);
  return { ok: true as const, paused };
}

export async function setOrderingHours(input: {
  slug: string;
  hoursJson: string | null;
}) {
  const { slug, hoursJson } = z
    .object({ slug: z.string(), hoursJson: z.string().nullable() })
    .parse(input);
  const { restaurant } = await ensureAuth(slug);
  // If non-null, validate it's parseable JSON
  if (hoursJson !== null) {
    try {
      JSON.parse(hoursJson);
    } catch {
      return { ok: false as const, error: "Invalid hours JSON" };
    }
  }
  await db.restaurant.update({
    where: { id: restaurant.id },
    data: { orderingHours: hoursJson },
  });
  revalidatePath(`/r/${slug}`);
  revalidatePath(`/r/${slug}/menu`);
  revalidatePath(`/r/${slug}/checkout`);
  revalidatePath(`/r/${slug}/admin/settings`);
  return { ok: true as const };
}

// ---------- Revenue PIN ----------

const PinSchema = z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits");

export async function setRevenuePin(input: { slug: string; pin: string | null }) {
  const { slug, pin } = z
    .object({ slug: z.string(), pin: z.string().nullable() })
    .parse(input);
  const { restaurant } = await ensureAuth(slug);

  if (pin === null) {
    await db.restaurant.update({
      where: { id: restaurant.id },
      data: { revenuePinHash: null },
    });
    revalidatePath(`/r/${slug}/admin`);
    return { ok: true as const, removed: true };
  }

  const parsed = PinSchema.safeParse(pin);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid PIN" };
  }
  const hash = await bcrypt.hash(pin, 10);
  await db.restaurant.update({
    where: { id: restaurant.id },
    data: { revenuePinHash: hash },
  });
  revalidatePath(`/r/${slug}/admin`);
  revalidatePath(`/r/${slug}/admin/settings`);
  return { ok: true as const, set: true };
}

export async function verifyRevenuePin(input: { slug: string; pin: string }) {
  const { slug, pin } = z
    .object({ slug: z.string(), pin: z.string() })
    .parse(input);
  // Verifying the PIN doesn't itself need full admin auth — but the data being
  // gated already lives behind admin auth, so we require it here for consistency.
  const { restaurant } = await ensureAuth(slug);
  if (!restaurant.revenuePinHash) return { ok: true as const, valid: true };
  const valid = await bcrypt.compare(pin, restaurant.revenuePinHash);
  return { ok: true as const, valid };
}

// ---------- Auth ----------

export async function logoutAction(slug: string) {
  await logoutUser();
  redirect(`/r/${slug}/admin/login`);
}
