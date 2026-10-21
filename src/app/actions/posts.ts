"use server";
import { revalidatePath } from "next/cache";
import { requireAccess } from "@/lib/auth";
import { getYouTube, syncYouTube } from "@/lib/youtube";
import { getInstagram, syncInstagram } from "@/lib/instagram";
import { getTikTok, syncTikTok } from "@/lib/tiktok";

/** Artist/admins: refresh post numbers now (at most every 10 minutes). */
export async function refreshPostStats() {
  await requireAccess("admin");
  const [{ channel }, ig, tt] = await Promise.all([getYouTube(), getInstagram(), getTikTok()]);
  if (!channel && !ig && !tt) return { ok: false as const, error: "Connect YouTube, Instagram or TikTok in Settings first." };
  const last = Math.max(channel ? Date.parse(channel.synced_at) : 0, ig?.synced_at ? Date.parse(ig.synced_at) : 0, tt?.synced_at ? Date.parse(tt.synced_at) : 0);
  if (Date.now() - last < 10 * 60_000) return { ok: true as const, note: "Already up to date (refreshed in the last 10 minutes)." };
  const [y, i, t] = await Promise.all([channel ? syncYouTube() : "skip", ig ? syncInstagram() : "skip", tt ? syncTikTok() : "skip"]);
  revalidatePath("/socials");
  revalidatePath("/");
  const failed = [y.startsWith("ok") || y === "skip" ? null : "YouTube", i.startsWith("ok") || i === "skip" ? null : "Instagram", t.startsWith("ok") || t === "skip" ? null : "TikTok"].filter(Boolean);
  return failed.length ? { ok: false as const, error: `${failed.join(" and ")} didn't answer. Try again in a minute.` } : { ok: true as const, note: "Updated ✓" };
}
