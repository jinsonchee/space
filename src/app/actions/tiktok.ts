"use server";
import { revalidatePath } from "next/cache";
import { requireAccess } from "@/lib/auth";
import { disconnectTikTok } from "@/lib/tiktok";

export async function removeTikTok() {
  await requireAccess("admin");
  await disconnectTikTok();
  revalidatePath("/", "layout");
}
