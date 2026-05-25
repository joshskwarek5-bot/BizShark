import bcrypt from "bcryptjs";
import { db } from "./db";
import { getSession, type SessionData } from "./session";

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function loginUser(email: string, password: string) {
  const user = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user) return { ok: false as const, error: "Invalid email or password" };
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return { ok: false as const, error: "Invalid email or password" };

  const session = await getSession();
  session.userId = user.id;
  session.email = user.email;
  session.name = user.name;
  session.role = user.role as SessionData["role"];
  session.restaurantId = user.restaurantId;
  await session.save();
  return { ok: true as const, user };
}

export async function logoutUser() {
  const session = await getSession();
  session.destroy();
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session.userId) return null;
  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: { restaurant: true },
  });
  return user;
}

/**
 * Ensures the current user can administer the given restaurant slug.
 * super_admin → any restaurant. restaurant_admin → only their own.
 */
export async function requireRestaurantAdmin(slug: string) {
  const session = await getSession();
  if (!session.userId) return { authorized: false as const, reason: "unauthenticated" };

  const restaurant = await db.restaurant.findUnique({ where: { slug } });
  if (!restaurant) return { authorized: false as const, reason: "not_found" };

  if (session.role === "super_admin") {
    return { authorized: true as const, restaurant, session };
  }
  if (session.role === "restaurant_admin" && session.restaurantId === restaurant.id) {
    return { authorized: true as const, restaurant, session };
  }
  return { authorized: false as const, reason: "forbidden" };
}

export async function requireSuperAdmin() {
  const session = await getSession();
  if (!session.userId) return { authorized: false as const, reason: "unauthenticated" };
  if (session.role !== "super_admin") return { authorized: false as const, reason: "forbidden" };
  return { authorized: true as const, session };
}
