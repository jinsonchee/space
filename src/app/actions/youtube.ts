"use server";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireAccess } from "@/lib/auth";
import { lookupChannel, saveChannel } from "@/lib/youtube";

/** Artist/admins: link the YouTube channel; fetches its numbers straight away. */
export async function setYouTubeChannel(input: string) {
  await requireAccess("admin");
  const r = await lookupChannel(input);
  if (!r.ok) return r;
  await saveChannel(input.trim(), r.channel);
  revalidatePath("/", "layout");
  return { ok: true as const, channel: r.channel };
}

export async function removeYouTubeChannel() {
  await requireAccess("admin");
  await sql`update settings set youtube_handle = null, youtube_channel = null where id = 1`;
  revalidatePath("/", "layout");
}
