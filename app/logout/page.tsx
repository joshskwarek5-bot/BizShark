import { redirect } from "next/navigation";
import { logoutUser } from "@/lib/auth";

export default async function LogoutPage() {
  await logoutUser();
  redirect("/login");
}
