"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PostRow } from "@/lib/posts";
import { refreshPostStats } from "../../actions/posts";
import { compact } from "@/lib/levels";

type Sort = "newest" | "views" | "growth" | "engagement";
const SORTS: { key: Sort; name: string }[] = [
  { key: "newest", name: "Newest" },
  { key: "views", name: "Most viewed" },
  { key: "growth", name: "Growing fastest" },
  { key: "engagement", name: "Most engaging" },
];
const PLATFORMS = [{ key: "all", name: "All" }, { key: "youtube", name: "▶ YouTube" }, { key: "instagram", name: "◎ Instagram" }, { key: "tiktok", name: "♪ TikTok" }] as const;
const KIND_NAME: Record<string, string> = { video: "Video", short: "Short", reel: "Reel", photo: "Photo", carousel: "Carousel" };

const n = (v: number | null) => (v === null ? "—" : compact(v));
/** Likes + comments (+ saves + shares on Instagram) per view — how much people react, not just watch. */
const engagement = (p: PostRow) => (p.views ? ((p.likes ?? 0) + (p.comments ?? 0) + (p.saves ?? 0) + (p.shares ?? 0)) / p.views : 0);
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "");

export default function PostsClient({ posts, historyDays, isAdmin, syncedAt }: { posts: PostRow[]; historyDays: number; isAdmin: boolean; syncedAt: string | null }) {
  const router = useRouter();
  const [sort, setSort] = useState<Sort>("newest");
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]["key"]>("all");
  const [kind, setKind] = useState("all");
  const kinds = useMemo(() => ["all", ...new Set(posts.filter((p) => platform === "all" || p.platform === platform).map((p) => p.kind))], [posts, platform]);
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const [pending, start] = useTransition();

  const monthAgo = Date.now() - 30 * 86_400_000;
  const growthKnown = posts.some((p) => p.views_7d !== null);
  const week = posts.reduce((s, p) => s + Math.max(0, p.views_7d ?? 0), 0);
  const thisMonth = posts.filter((p) => p.published_at && Date.parse(p.published_at) >= monthAgo).length;
  const recent = posts.slice(0, 10).filter((p) => p.views !== null);
  const avg = recent.length ? recent.reduce((s, p) => s + (p.views ?? 0), 0) / recent.length : 0;

  // "Top this week": biggest 7-day gains; before there's a week of history, the most viewed recent posts.
  const top = useMemo(() => {
    const pool = growthKnown ? posts.filter((p) => (p.views_7d ?? 0) > 0).sort((a, b) => (b.views_7d ?? 0) - (a.views_7d ?? 0))
      : posts.filter((p) => p.published_at && Date.parse(p.published_at) >= monthAgo).sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
    return pool.slice(0, 3);
  }, [posts, growthKnown, monthAgo]);

  const list = useMemo(() => {
    const l = posts.filter((p) => (platform === "all" || p.platform === platform) && (kind === "all" || p.kind === kind));
    const by: Record<Sort, (a: PostRow, b: PostRow) => number> = {
      newest: (a, b) => Date.parse(b.published_at ?? "0") - Date.parse(a.published_at ?? "0"),
      views: (a, b) => (b.views ?? 0) - (a.views ?? 0),
      growth: (a, b) => (b.views_7d ?? -1) - (a.views_7d ?? -1),
      engagement: (a, b) => engagement(b) - engagement(a),
    };
    return [...l].sort(by[sort]);
  }, [posts, platform, kind, sort]);

  const refresh = () => start(async () => {
    const r = await refreshPostStats();
    setMsg(r.ok ? { t: r.note } : { t: r.error, bad: true });
    router.refresh();
  });

  return (
    <>
      <div className="grid g-3" style={{ marginBottom: 16 }}>
        <div className="card card-tight"><div className="tiny muted">Views gained, last 7 days</div><div className="stat-value">{growthKnown ? `+${compact(week)}` : "—"}</div>
          {!growthKnown && <div className="tiny muted">Appears after a week of daily updates{historyDays ? ` (day ${historyDays} of 7)` : ""}.</div>}</div>
        <div className="card card-tight"><div className="tiny muted">Posts in the last 30 days</div><div className="stat-value">{thisMonth}</div></div>
        <div className="card card-tight"><div className="tiny muted">Average views, latest 10 posts</div><div className="stat-value">{compact(Math.round(avg))}</div></div>
      </div>

      {top.length > 0 && (
        <section className="card" style={{ marginBottom: 16 }}>
          <div className="card-title"><h2>{growthKnown ? "Top this week" : "Top recent posts"}</h2></div>
          <div className="grid g-3">
            {top.map((p, i) => (
              <a key={p.post_id} href={p.url ?? "#"} target="_blank" rel="noreferrer" className="post-top">
                {p.thumbnail && /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.thumbnail} alt="" loading="lazy" />}
                <span className="post-rank">#{i + 1}</span>
                <span className="small" style={{ fontWeight: 600, display: "block", marginTop: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</span>
                <span className="tiny muted">{growthKnown ? `+${n(p.views_7d)} views this week` : `${n(p.views)} views`} · {day(p.published_at)}</span>
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="card" style={{ padding: 0 }}>
        <div className="row between wrap" style={{ gap: 10, padding: "14px 16px", borderBottom: "1px solid var(--line)" }}>
          <div className="row wrap" style={{ gap: 8 }}>
            <div className="seg" role="tablist" aria-label="Platform">
              {PLATFORMS.filter((pl) => pl.key === "all" || posts.some((p) => p.platform === pl.key)).map((pl) => (
                <button key={pl.key} role="tab" aria-pressed={platform === pl.key} onClick={() => { setPlatform(pl.key); setKind("all"); }}>{pl.name}</button>
              ))}
            </div>
            {kinds.length > 2 && (
              <select className="select" style={{ height: 36, width: "auto" }} value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Type">
                {kinds.map((k) => <option key={k} value={k}>{k === "all" ? "All types" : `${KIND_NAME[k] ?? k}s`}</option>)}
              </select>
            )}
          </div>
          <div className="row wrap" style={{ gap: 8 }}>
            <select className="select" style={{ height: 36, width: "auto" }} value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort by">
              {SORTS.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
            </select>
            {isAdmin && <button className="btn btn-sm" onClick={refresh} disabled={pending}>{pending ? "Refreshing…" : "Refresh now"}</button>}
          </div>
        </div>
        {msg && <p className="small" style={{ padding: "8px 16px 0", color: msg.bad ? "var(--danger)" : "var(--success)" }}>{msg.t}</p>}
        <div className="post-head tiny muted"><span>Post</span><span>Views</span><span>7 days</span><span>Likes</span><span>Comments</span><span>Engagement</span></div>
        {list.map((p) => (
          <a key={p.post_id} href={p.url ?? "#"} target="_blank" rel="noreferrer" className="post-row">
            <span className="row" style={{ gap: 12, minWidth: 0 }}>
              {p.thumbnail ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.thumbnail} alt="" loading="lazy" className="post-thumb" /> : <span className="post-thumb" />}
              <span style={{ minWidth: 0 }}>
                <span className="small" style={{ fontWeight: 600, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</span>
                <span className="tiny muted">{p.platform === "instagram" ? "◎" : p.platform === "tiktok" ? "♪" : "▶"} {day(p.published_at)} · {KIND_NAME[p.kind] ?? p.kind}{p.reach !== null ? ` · reached ${compact(p.reach)}` : ""}{p.saves ? ` · ${compact(p.saves)} saves` : ""}{p.shares ? ` · ${compact(p.shares)} shares` : ""}</span>
              </span>
            </span>
            <span className="post-num" data-label="Views">{n(p.views)}</span>
            <span className="post-num" data-label="7 days" style={{ color: (p.views_7d ?? 0) > 0 ? "var(--success)" : undefined }}>{p.views_7d === null ? "—" : `+${compact(p.views_7d)}`}</span>
            <span className="post-num" data-label="Likes">{n(p.likes)}</span>
            <span className="post-num" data-label="Comments">{n(p.comments)}</span>
            <span className="post-num" data-label="Engagement">{p.views ? `${(engagement(p) * 100).toFixed(1)}%` : "—"}</span>
          </a>
        ))}
        <p className="tiny muted" style={{ padding: "12px 16px" }}>Updated daily{syncedAt ? ` · last update ${new Date(syncedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}. Engagement = likes + comments (+ saves + shares on Instagram) per view.</p>
      </section>
    </>
  );
}
