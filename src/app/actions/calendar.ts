"use server";
import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth";
import { disconnect, turnOff } from "@/lib/google";

/** Fully disconnects Google (deletes the keys and revokes access at Google). */
export async function disconnectCalendar() {
  const me = await requireMember();
  await disconnect(me.id);
  revalidatePath("/", "layout");
}

/** Turns off just Calendar or just Gmail. */
export async function turnOffGoogleFeature(feature: "calendar" | "gmail") {
  const me = await requireMember();
  await turnOff(me.id, feature === "gmail" ? "gmail" : "calendar");
  revalidatePath("/", "layout");
}
