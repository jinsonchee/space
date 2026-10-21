import { redirect } from "next/navigation";
import { requireMember, atLeast } from "@/lib/auth";
import { getSettings } from "@/lib/db";
import { checkForUpdate } from "@/lib/version";
import { emailEnabled } from "@/lib/notify";
import { getYouTube, youtubeConfigured } from "@/lib/youtube";
import SettingsClient from "./SettingsClient";
import { YouTubeCard } from "./YouTubeCard";
import { InstagramCard } from "./InstagramCard";
import { getInstagram, instagramConfigured } from "@/lib/instagram";
import { TikTokCard } from "./TikTokCard";
import { getTikTok, tiktokConfigured } from "@/lib/tiktok";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ instagram?: string; tiktok?: string }> }) {
  const me = await requireMember();
  if (!atLeast(me, "admin")) redirect("/profile"); // whole-Space settings are for the artist and admins
  const [s, update, yt, ig, sp] = await Promise.all([getSettings(), checkForUpdate(), getYouTube(), getInstagram(), searchParams]);
  const tt = await getTikTok();
  const ttInfo = tt ? { username: tt.username, status: tt.status, followers: tt.followers, video_count: tt.video_count, synced_at: tt.synced_at } : null;
  // Never send the (encrypted) token to the page.
  const igInfo = ig ? { username: ig.username, status: ig.status, followers: ig.followers, media_count: ig.media_count, synced_at: ig.synced_at } : null;
  return (
    <>
      <SettingsClient
        settings={s!}
        isMaster={me.access === "master"}
        update={update}
        email={emailEnabled()}
        repoUrl={process.env.UPDATE_REPO_URL ?? null}
      />
      <YouTubeCard configured={youtubeConfigured()} handle={yt.handle} channel={yt.channel} canEdit={atLeast(me, "admin")} />
      <InstagramCard configured={instagramConfigured()} account={igInfo} canEdit={atLeast(me, "admin")} result={sp.instagram ?? null} />
      <TikTokCard configured={tiktokConfigured()} account={ttInfo} canEdit={atLeast(me, "admin")} result={sp.tiktok ?? null} />
    </>
  );
}
