"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeTikTok } from "../../actions/tiktok";
import { compact } from "@/lib/levels";

type Info = { username: string; status: "ok" | "expired"; followers: number | null; video_count: number | null; synced_at: string | null } | null;
const RESULT: Record<string, { t: string; bad?: boolean; info?: boolean }> = {
  connected: { t: "TikTok connected ✓ Followers and posts now update every day." },
  cancelled: { t: "No problem, nothing was connected.", info: true },
  failed: { t: "That didn't work. Make sure this TikTok account was added as a test user on the app, then try again.", bad: true },
  unavailable: { t: "TikTok isn't set up for this Space yet.", bad: true },
};

export function TikTokCard({ configured, account, canEdit, result }: { configured: boolean; account: Info; canEdit: boolean; result: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const msg = result ? RESULT[result] : null;
  return (
    <section className="card" style={{ marginTop: 16 }} id="tiktok">
      <h2 style={{ marginBottom: 6 }}>TikTok stats</h2>
      <p className="small muted" style={{ marginBottom: 14 }}>Followers update every day on Home and in your goals, and every video&apos;s views, likes, comments and shares appear in Post Stats.</p>
      {msg && <p className="small" style={{ marginBottom: 12, color: msg.bad ? "var(--danger)" : msg.info ? "var(--muted)" : "var(--success)" }}>{msg.t}</p>}
      {!configured ? (
        <p className="small faint">Not available yet. Whoever set up this Space needs to add TikTok.</p>
      ) : account ? (
        <>
          <div className="grid g-3" style={{ gap: 10, marginBottom: 12 }}>
            <div className="card card-tight" style={{ background: "var(--surface-2)" }}><div className="tiny muted">Account</div><strong>@{account.username}</strong></div>
            <div className="card card-tight" style={{ background: "var(--surface-2)" }}><div className="tiny muted">Followers</div><strong>{account.followers === null ? "—" : compact(account.followers)}</strong></div>
            <div className="card card-tight" style={{ background: "var(--surface-2)" }}><div className="tiny muted">Videos</div><strong>{account.video_count ?? "—"}</strong></div>
          </div>
          {account.status === "expired" && <p className="small" style={{ color: "var(--warn)", marginBottom: 10 }}>TikTok stopped sharing stats. Reconnect to resume.</p>}
          {account.synced_at && <p className="tiny muted" style={{ marginBottom: 10 }}>Last updated {new Date(account.synced_at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>}
          {canEdit && (
            <div className="row" style={{ gap: 8 }}>
              {account.status === "expired" && <a className="btn btn-accent" href="/api/tiktok/connect">Reconnect</a>}
              <button className="btn btn-ghost" disabled={pending} onClick={() => start(async () => { await removeTikTok(); router.refresh(); })}>Disconnect</button>
            </div>
          )}
        </>
      ) : canEdit ? (
        <div className="col" style={{ gap: 8 }}>
          <div><a className="btn btn-accent" href="/api/tiktok/connect">Connect TikTok</a></div>
          <p className="tiny muted">The TikTok account must be added as a test user on the TikTok app first.</p>
        </div>
      ) : (
        <p className="small faint">The artist or an admin can connect TikTok.</p>
      )}
    </section>
  );
}
