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

export async function restaurantLogin(
  slug: string,
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

  const restaurant = await db.restaurant.findUnique({ where: { slug } });
  if (!restaurant) return { ok: false, error: "Restaurant not found" };

  const res = await loginUser(parsed.data.email, parsed.data.password);
  if (!res.ok) return { ok: false, error: res.error };

  const isSuper = res.user.role === "super_admin";
  const isThisRestaurantAdmin =
    res.user.role === "restaurant_admin" && res.user.restaurantId === restaurant.id;

  if (!isSuper && !isThisRestaurantAdmin) {
    return { ok: false, error: "Your account isn't authorized for this restaurant." };
  }

  redirect(`/r/${slug}/admin`);
}
