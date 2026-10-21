import "server-only";
import { sql, getSettings } from "./db";
import { addDays, todayIn } from "./dates";
import { youtubeConfigured } from "./youtube";

// Daily Trends from YouTube (official API, the artist's own key). Each search costs 100 of the
// 10,000 free daily units (and there's a cap of 100 searches a day), so this runs once a day.
export const TREND_TAGS = ["singersongwriter", "originalmusic", "popmusic", "indiemusic"];
export const TREND_CHARTS = [{ code: "SG", name: "Singapore" }, { code: "MY", name: "Malaysia" }];

export type TrendItem = { source: string; rank: number; video_id: string; title: string; channel: string; thumbnail: string | null; views: number | null; published_at: string | null; isNew: boolean };

const yt = async <T>(path: string, params: Record<string, string>) => {
  const res = await fetch(`https://www.googleapis.com/youtube/v3/${path}?${new URLSearchParams({ ...params, key: process.env.YOUTUBE_API_KEY! })}`, { signal: AbortSignal.timeout(10000), cache: "no-store" });
  if (!res.ok) { console.error(`[trends] ${path} → ${res.status}`); return null; }
  return (await res.json()) as T;
};
type V = { id: string; snippet: { title: string; channelTitle: string; publishedAt: string; thumbnails?: Record<string, { url: string }> }; statistics?: { viewCount?: string } };
const thumb = (v: V) => (v.snippet.thumbnails?.medium ?? v.snippet.thumbnails?.high ?? v.snippet.thumbnails?.default)?.url ?? null;

async function save(day: string, source: string, videos: V[]) {
  await sql`delete from trend_items where day = ${day} and source = ${source}`;
  let rank = 1;
  for (const v of videos.slice(0, 12)) {
    await sql`
      insert into trend_items (day, source, rank, video_id, title, channel, thumbnail, views, published_at)
      values (${day}, ${source}, ${rank++}, ${v.id}, ${v.snippet.title}, ${v.snippet.channelTitle}, ${thumb(v)}, ${v.statistics?.viewCount ? Number(v.statistics.viewCount) : null}, ${v.snippet.publishedAt})`;
  }
}

/** Fetches today's trends (skips if already done today unless forced). */
export async function syncTrends(force = false) {
  if (!youtubeConfigured()) return "off";
  const s = await getSettings();
  const today = todayIn(s!.timezone);
  if (!force) {
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from trend_items where day = ${today}`;
    if (n > 0) return "already";
  }
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  for (const tag of TREND_TAGS) {
    const found = await yt<{ items?: { id: { videoId: string } }[] }>("search", { part: "id", q: `#${tag}`, type: "video", order: "viewCount", publishedAfter: weekAgo, maxResults: "12" });
    const ids = found?.items?.map((i) => i.id.videoId).filter(Boolean) ?? [];
    if (!ids.length) continue;
    const details = await yt<{ items?: V[] }>("videos", { part: "snippet,statistics", id: ids.join(",") });
    const byId = new Map((details?.items ?? []).map((v) => [v.id, v]));
    await save(today, `tag:${tag}`, ids.map((id) => byId.get(id)).filter((v): v is V => Boolean(v)));
  }
  for (const c of TREND_CHARTS) {
    const chart = await yt<{ items?: V[] }>("videos", { part: "snippet,statistics", chart: "mostPopular", videoCategoryId: "10", regionCode: c.code, maxResults: "12" });
    if (chart?.items?.length) await save(today, `chart:${c.code}`, chart.items);
  }
  await sql`delete from trend_items where day < ${addDays(today, -14)}`;
  return "ok";
}

/** The latest day's trends, with "new" marked for videos that weren't there the day before. */
export async function getTrends() {
  const [latest] = await sql<{ day: string }[]>`select max(day)::text as day from trend_items`;
  if (!latest?.day) return { day: null, items: [] as TrendItem[] };
  const prevDay = addDays(latest.day, -1);
  const rows = await sql<(Omit<TrendItem, "isNew"> & { was: boolean })[]>`
    select t.source, t.rank, t.video_id, t.title, t.channel, t.thumbnail, t.views::float8 as views, t.published_at::text,
      exists (select 1 from trend_items p where p.day = ${prevDay} and p.source = t.source and p.video_id = t.video_id) as was
    from trend_items t where t.day = ${latest.day} order by t.source, t.rank`;
  const [{ hadYesterday }] = await sql<{ hadYesterday: boolean }[]>`select exists (select 1 from trend_items where day = ${prevDay}) as "hadYesterday"`;
  return { day: latest.day, items: rows.map(({ was, ...r }) => ({ ...r, isNew: hadYesterday && !was })) };
}
