import Link from "next/link";
import { requireMember, atLeast } from "@/lib/auth";
import { getPosts } from "@/lib/posts";
import { getYouTube } from "@/lib/youtube";
import { getInstagram } from "@/lib/instagram";
import { getTikTok } from "@/lib/tiktok";
import PostsClient from "./PostsClient";

export const dynamic = "force-dynamic";

export default async function PostStatsPage() {
  const me = await requireMember();
  const [{ posts, historyDays }, yt, ig, tt] = await Promise.all([getPosts(), getYouTube(), getInstagram(), getTikTok()]);
  const linked = [yt.channel ? `YouTube: ${yt.channel.title}` : null, ig ? `Instagram: @${ig.username}` : null, tt ? `TikTok: @${tt.username}` : null].filter(Boolean).join(" · ");
  const syncedAt = [yt.channel?.synced_at, ig?.synced_at, tt?.synced_at].filter((x): x is string => Boolean(x)).sort().pop() ?? null;
  const isAdmin = atLeast(me, "admin");
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Post Stats</h1>
          <p className="muted">How every post is doing{linked ? ` · ${linked}` : ""}</p>
        </div>
      </div>
      {!yt.channel && !ig && !tt ? (
        <div className="card empty">
          <p style={{ fontWeight: 600, color: "var(--text)" }}>No channels linked yet</p>
          <p className="small" style={{ margin: "6px 0 14px" }}>Connect YouTube, Instagram or TikTok in Settings and every post&apos;s numbers show up here, updated daily.</p>
          {isAdmin && <Link className="btn btn-accent" href="/settings#youtube">Go to Settings</Link>}
        </div>
      ) : (
        <PostsClient posts={JSON.parse(JSON.stringify(posts))} historyDays={historyDays} isAdmin={isAdmin} syncedAt={syncedAt} />
      )}
    </>
  );
}
