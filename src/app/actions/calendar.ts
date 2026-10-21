"use server";
import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { disconnect } from "@/lib/google";

export async function disconnectCalendar() {
  const me = await requireMember();
  await disconnect(me.id);
  revalidatePath("/", "layout");
}
