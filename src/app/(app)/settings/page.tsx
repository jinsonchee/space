import { redirect } from "next/navigation";
import { requireMember, atLeast } from "@/lib/auth";
import { getSettings } from "@/lib/db";
import { checkForUpdate } from "@/lib/version";
import { emailEnabled } from "@/lib/notify";
import { getYouTube, youtubeConfigured } from "@/lib/youtube";
import SettingsClient from "./SettingsClient";
import { YouTubeCard } from "./YouTubeCard";

export default async function SettingsPage() {
  const me = await requireMember();
  if (!atLeast(me, "admin")) redirect("/profile"); // whole-Space settings are for the artist and admins
  const [s, update, yt] = await Promise.all([getSettings(), checkForUpdate(), getYouTube()]);
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
    </>
  );
}
