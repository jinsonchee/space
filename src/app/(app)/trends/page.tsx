import Link from "next/link";
import { requireMember, atLeast } from "@/lib/auth";
import { getTrends, TREND_CHARTS, TREND_TAGS } from "@/lib/trends";
import { youtubeConfigured } from "@/lib/youtube";
import TrendsClient from "./TrendsClient";

export const dynamic = "force-dynamic";

export default async function TrendsPage() {
  const me = await requireMember();
  const t = await getTrends();
  const isAdmin = atLeast(me, "admin");
  const sources = [
    ...TREND_TAGS.map((tag) => ({ key: `tag:${tag}`, name: `#${tag}` })),
    ...TREND_CHARTS.map((c) => ({ key: `chart:${c.code}`, name: `Music · ${c.name}` })),
  ];
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Daily Trends</h1>
          <p className="muted">What&apos;s taking off this week{t.day ? ` · updated ${new Date(`${t.day}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}` : ""}</p>
        </div>
      </div>
      {!youtubeConfigured() ? (
        <div className="card empty"><p>Trends need a YouTube key. Whoever set up this Space can add one.</p></div>
      ) : (
        <TrendsClient items={JSON.parse(JSON.stringify(t.items))} sources={sources} hasData={Boolean(t.day)} isAdmin={isAdmin} />
      )}
      <section className="card" style={{ marginTop: 16 }}>
        <div className="card-title"><h2>TikTok trends</h2></div>
        <p className="small muted" style={{ marginBottom: 12 }}>TikTok doesn&apos;t share trends with apps, so these open TikTok&apos;s own trend pages.</p>
        <div className="row wrap" style={{ gap: 8 }}>
          <Link className="btn btn-sm" href="https://ads.tiktok.com/business/creativecenter/inspiration/popular/music/pc/en" target="_blank" rel="noreferrer">Trending songs ↗</Link>
          <Link className="btn btn-sm" href="https://ads.tiktok.com/business/creativecenter/inspiration/popular/hashtag/pc/en" target="_blank" rel="noreferrer">Trending hashtags ↗</Link>
          <Link className="btn btn-sm" href="https://www.tiktok.com/tag/singersongwriter" target="_blank" rel="noreferrer">#singersongwriter on TikTok ↗</Link>
        </div>
      </section>
    </>
  );
}
