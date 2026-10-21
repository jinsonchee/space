"use server";
import { revalidatePath } from "next/cache";
import { requireAccess } from "@/lib/auth";
import { disconnectInstagram } from "@/lib/instagram";

export async function removeInstagram() {
  await requireAccess("admin");
  await disconnectInstagram();
  revalidatePath("/", "layout");
}
