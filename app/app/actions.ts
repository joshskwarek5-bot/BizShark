"use server";

import { redirect } from "next/navigation";
import { logoutUser } from "@/lib/auth";

export async function operatorLogoutAction() {
  await logoutUser();
  redirect("/login");
}
