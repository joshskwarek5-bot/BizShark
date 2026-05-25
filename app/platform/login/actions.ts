"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { loginUser } from "@/lib/auth";

const Schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export interface LoginState {
  ok: boolean;
  error?: string;
}

export async function platformLogin(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = Schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const res = await loginUser(parsed.data.email, parsed.data.password);
  if (!res.ok) return { ok: false, error: res.error };

  if (res.user.role !== "super_admin") {
    return { ok: false, error: "Only platform administrators can sign in here." };
  }
  redirect("/platform");
}
