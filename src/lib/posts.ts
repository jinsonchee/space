import "server-only";
import { sql, getSettings } from "./db";
import { addDays, todayIn } from "./dates";

export type PostRow = {
  platform: string; post_id: string; title: string; url: string | null; thumbnail: string | null; kind: string; published_at: string | null;
  views: number | null; likes: number | null; comments: number | null; shares: number | null; saves: number | null; reach: number | null; views_7d: number | null;
};

/** Every post with its latest numbers and how many views it gained in the last 7 days. */
export async function getPosts() {
  const s = await getSettings();
  const today = todayIn(s!.timezone);
  const weekAgo = addDays(today, -7);
  const rows = await sql<(PostRow & { prev_views: number | null })[]>`
    with latest as (
      select distinct on (platform, post_id) platform, post_id, views, likes, comments, shares, saves, reach
      from post_snapshots order by platform, post_id, captured_on desc
    ), prev as (
      select distinct on (platform, post_id) platform, post_id, views
      from post_snapshots where captured_on <= ${weekAgo} order by platform, post_id, captured_on desc
    )
    select p.platform, p.post_id, p.title, p.url, p.thumbnail, p.kind, p.published_at::text,
      l.views::float8 as views, l.likes::float8 as likes, l.comments::float8 as comments,
      l.shares::float8 as shares, l.saves::float8 as saves, l.reach::float8 as reach, pr.views::float8 as prev_views
    from posts p
    left join latest l on l.platform = p.platform and l.post_id = p.post_id
    left join prev pr on pr.platform = p.platform and pr.post_id = p.post_id
    order by p.published_at desc nulls last`;
  const [{ days }] = await sql<{ days: number }[]>`select count(distinct captured_on)::int as days from post_snapshots`;
  const weekAgoMs = Date.parse(`${weekAgo}T00:00:00Z`);
  const posts: PostRow[] = rows.map(({ prev_views, ...r }) => ({
    ...r,
    // Growth needs a snapshot from a week ago; brand-new posts count all their views.
    views_7d: r.views === null ? null : prev_views !== null ? r.views - prev_views : r.published_at && Date.parse(r.published_at) >= weekAgoMs ? r.views : null,
  }));
  return { posts, historyDays: days };
}
