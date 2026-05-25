import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";

export interface SessionData {
  userId?: string;
  email?: string;
  name?: string | null;
  role?: "super_admin" | "operator" | "restaurant_admin";
  // For restaurant_admin only
  restaurantId?: string | null;
  // For operator only
  operatorId?: string | null;
}

const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET || SESSION_SECRET.length < 32) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set to at least 32 characters in production.");
  }
}

export const sessionOptions: SessionOptions = {
  password:
    SESSION_SECRET && SESSION_SECRET.length >= 32
      ? SESSION_SECRET
      : "dev_only_change_me_to_32_plus_chars_xxxxxxxxxxxxx",
  cookieName: "rp_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  },
};

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

export async function requireSession() {
  const session = await getSession();
  if (!session.userId) throw new Error("Not authenticated");
  return session;
}
