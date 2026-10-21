"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { YouTubeChannel } from "@/lib/youtube";
import { setYouTubeChannel, removeYouTubeChannel } from "../../actions/youtube";
import { compact } from "@/lib/levels";

export function YouTubeCard({ configured, handle, channel, canEdit }: { configured: boolean; handle: string | null; channel: YouTubeChannel | null; canEdit: boolean }) {
  const router = useRouter();
  const [input, setInput] = useState(handle ?? "");
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const [pending, start] = useTransition();
  const save = () => start(async () => {
    setMsg(null);
    const r = await setYouTubeChannel(input);
    if (!r.ok) return setMsg({ t: r.error, bad: true });
    setMsg({ t: `Linked to ${r.channel.title} ✓ Numbers now update every day.` });
    router.refresh();
  });

  return (
    <section className="card" style={{ marginTop: 16 }} id="youtube">
      <h2 style={{ marginBottom: 6 }}>YouTube stats</h2>
      <p className="small muted" style={{ marginBottom: 14 }}>Subscribers update automatically every day on Home and in your goals. YouTube rounds public subscriber counts (e.g. 12,345 shows as 12.3K).</p>
      {!configured ? (
        <p className="small faint">Not available yet. Whoever set up this Space needs to add a YouTube key.</p>
      ) : (
        <>
          {channel && (
            <div className="grid g-3" style={{ gap: 10, marginBottom: 14 }}>
              <div className="card card-tight" style={{ background: "var(--surface-2)" }}><div className="tiny muted">Subscribers</div><strong>{channel.subscribers === null ? "Hidden" : compact(channel.subscribers)}</strong></div>
              <div className="card card-tight" style={{ background: "var(--surface-2)" }}><div className="tiny muted">Total views</div><strong>{compact(channel.views)}</strong></div>
              <div className="card card-tight" style={{ background: "var(--surface-2)" }}><div className="tiny muted">Videos</div><strong>{channel.videos}</strong></div>
            </div>
          )}
          {channel && <p className="tiny muted" style={{ marginBottom: 12 }}>Linked to <strong>{channel.title}</strong> · last updated {new Date(channel.synced_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}{channel.hidden ? " · this channel hides its subscriber count, so it can't be tracked" : ""}</p>}
          {canEdit ? (
            <div className="row wrap" style={{ gap: 8 }}>
              <input className="input" style={{ flex: "1 1 220px" }} value={input} onChange={(e) => setInput(e.target.value)} placeholder="@yourchannel" aria-label="YouTube channel handle" onKeyDown={(e) => e.key === "Enter" && input.trim() && save()} />
              <button className="btn btn-accent" onClick={save} disabled={pending || !input.trim()}>{pending ? "Checking…" : channel ? "Update" : "Link channel"}</button>
              {channel && <button className="btn btn-ghost" disabled={pending} onClick={() => start(async () => { await removeYouTubeChannel(); setInput(""); setMsg(null); router.refresh(); })}>Remove</button>}
            </div>
          ) : !channel && <p className="small faint">The artist or an admin can link the channel.</p>}
          {msg && <p className="small" style={{ marginTop: 10, color: msg.bad ? "var(--danger)" : "var(--success)" }}>{msg.t}</p>}
        </>
      )}
    </section>
  );
}
