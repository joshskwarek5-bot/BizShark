"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { hashPassword } from "@/lib/auth";

const Schema = z.object({
  email: z.string().email("Enter a valid email").max(120),
  password: z.string().min(8, "Password must be at least 8 characters").max(120),
  name: z.string().min(1, "Add your name").max(120),
  businessName: z.string().max(120).optional(),
  areaCity: z.string().max(80).optional(),
  areaState: z.string().max(40).optional(),
});

export interface SignupState {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

export async function signupOperator(
  _prev: SignupState,
  formData: FormData
): Promise<SignupState> {
  const parsed = Schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    name: formData.get("name"),
    businessName: formData.get("businessName") || undefined,
    areaCity: formData.get("areaCity") || undefined,
    areaState: formData.get("areaState") || undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the errors and try again.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const data = parsed.data;
  const email = data.email.toLowerCase().trim();

  // Email must be unique across both User and Operator tables
  const [existingUser, existingOperator] = await Promise.all([
    db.user.findUnique({ where: { email } }),
    db.operator.findUnique({ where: { email } }),
  ]);
  if (existingUser || existingOperator) {
    return {
      ok: false,
      error: "An account with that email already exists. Sign in instead.",
      fieldErrors: { email: ["Already in use"] },
    };
  }

  // Create Operator + first User, then log them in
  const passwordHash = await hashPassword(data.password);
  const trialDays = 14;
  const trialEndsAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);

  const { operator } = await db.$transaction(async (tx) => {
    const operator = await tx.operator.create({
      data: {
        email,
        name: data.name,
        businessName: data.businessName?.trim() || null,
        areaCity: data.areaCity?.trim() || null,
        areaState: data.areaState?.trim() || null,
        subscriptionStatus: "trial",
        subscriptionTier: "starter",
        trialEndsAt,
      },
    });
    await tx.user.create({
      data: {
        email,
        passwordHash,
        name: data.name,
        role: "operator",
        operatorId: operator.id,
      },
    });
    return { operator };
  });

  // Log them in
  const user = await db.user.findUnique({ where: { email } });
  if (!user) return { ok: false, error: "Signup failed — please try again." };
  const session = await getSession();
  session.userId = user.id;
  session.email = user.email;
  session.name = user.name;
  session.role = "operator";
  session.operatorId = operator.id;
  session.restaurantId = null;
  await session.save();

  redirect("/app");
}
