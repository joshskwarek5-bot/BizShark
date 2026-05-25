"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { loginUser } from "@/lib/auth";

const Schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

export interface LoginState {
  ok: boolean;
  error?: string;
}

/**
 * Universal login. Routes the user to the right dashboard based on role:
 *   operator         → /app
 *   super_admin      → /platform
 *   restaurant_admin → /r/<slug>/admin
 */
export async function loginAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = Schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const res = await loginUser(parsed.data.email, parsed.data.password);
  if (!res.ok) return { ok: false, error: res.error };

  // Route by role
  if (res.user.role === "operator") {
    redirect("/app");
  }
  if (res.user.role === "super_admin") {
    redirect("/platform");
  }
  if (res.user.role === "restaurant_admin" && res.user.restaurantId) {
    const restaurant = await db.restaurant.findUnique({
      where: { id: res.user.restaurantId },
      select: { slug: true },
    });
    if (restaurant) redirect(`/r/${restaurant.slug}/admin`);
  }
  // Fallback (shouldn't happen with a valid role)
  redirect("/");
}
