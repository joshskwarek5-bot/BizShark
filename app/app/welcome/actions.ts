"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/auth";

export async function completeOnboarding() {
  const res = await requireOperator();
  if (!res.authorized) redirect("/login");
  await db.operator.update({
    where: { id: res.operator.id },
    data: { onboardingCompletedAt: new Date() },
  });
  revalidatePath("/app");
  redirect("/app?welcome=done");
}
