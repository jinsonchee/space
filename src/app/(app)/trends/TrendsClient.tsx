"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TrendItem } from "@/lib/trends";
import { refreshTrends } from "../../actions/trends";
import { compact } from "@/lib/levels";

const ago = (iso: string | null) => {
  if (!iso) return "";
  const d = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 86_400_000));
  return d === 0 ? "today" : d === 1 ? "1 day ago" : d < 30 ? `${d} days ago` : new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

export default function TrendsClient({ items, sources, hasData, isAdmin }: { items: TrendItem[]; sources: { key: string; name: string }[]; hasData: boolean; isAdmin: boolean }) {
  const router = useRouter();
  const [src, setSrc] = useState(sources[0].key);
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const [pending, start] = useTransition();
  const shown = items.filter((i) => i.source === src);
  const refresh = () => start(async () => {
    const r = await refreshTrends();
    setMsg(r.ok ? { t: r.note } : { t: r.error, bad: true });
    router.refresh();
  });

  return (
    <section className="card">
      <div className="row between wrap" style={{ gap: 10, marginBottom: 14 }}>
        <div className="seg" role="tablist" aria-label="Trend source" style={{ flexWrap: "wrap" }}>
          {sources.map((s) => (
            <button key={s.key} role="tab" aria-pressed={src === s.key} onClick={() => setSrc(s.key)}>
              {s.name}{items.some((i) => i.source === s.key && i.isNew) && <span className="trend-dot" aria-label="has new videos" />}
            </button>
          ))}
        </div>
        {isAdmin && <button className="btn btn-sm" onClick={refresh} disabled={pending}>{pending ? "Refreshing…" : "Refresh now"}</button>}
      </div>
      {msg && <p className="small" style={{ marginBottom: 10, color: msg.bad ? "var(--danger)" : "var(--success)" }}>{msg.t}</p>}
      {!hasData ? (
        <div className="empty"><p>Trends arrive each morning.{isAdmin ? " Click Refresh now to fetch today's." : ""}</p></div>
      ) : shown.length === 0 ? (
        <div className="empty"><p>Nothing found for this one today.</p></div>
      ) : (
        <div className="trend-grid">
          {shown.map((v) => (
            <a key={v.video_id} href={`https://www.youtube.com/watch?v=${v.video_id}`} target="_blank" rel="noreferrer" className="trend-card">
              <span className="trend-thumb">
                {v.thumbnail && /* eslint-disable-next-line @next/next/no-img-element */ <img src={v.thumbnail} alt="" loading="lazy" />}
                <span className="post-rank">#{v.rank}</span>
                {v.isNew && <span className="trend-new">New today</span>}
              </span>
              <span className="small" style={{ fontWeight: 600, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", marginTop: 8 }}>{v.title}</span>
              <span className="tiny muted" style={{ display: "block", marginTop: 2 }}>{v.channel}</span>
              <span className="tiny muted">{v.views !== null ? `${compact(v.views)} views · ` : ""}{ago(v.published_at)}</span>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
