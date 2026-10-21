import Link from "next/link";
import type { GmailResult, ThreadSummary } from "@/lib/gmail";
import { I } from "@/components/Icons";

/** Home: unread count and the latest few unread emails. */
export default function InboxCard({ r, times }: { r: GmailResult<{ threads: ThreadSummary[]; estimate: number }> | { state: "connect" }; times: Record<string, string> }) {
  return (
    <section className="card">
      <div className="card-title">
        <div>
          <span className="eyebrow">Inbox</span>
          <h2 style={{ marginTop: 4 }}>{r.state === "ok" ? (r.threads.length ? `${r.estimate > r.threads.length ? `${r.estimate}+` : r.threads.length} unread` : "All caught up") : "Your email"}</h2>
        </div>
        {r.state === "ok" && <Link href="/inbox" className="btn btn-sm btn-ghost">Open <I.right style={{ width: 14 }} /></Link>}
      </div>
      {r.state === "connect" && (
        <div className="row between wrap" style={{ gap: 10 }}>
          <p className="small muted">See unread emails here by connecting your Gmail.</p>
          <a href="/api/google/connect?want=gmail" className="btn btn-sm">Connect Gmail</a>
        </div>
      )}
      {r.state === "expired" && (
        <div className="row between wrap" style={{ gap: 10 }}>
          <p className="small" style={{ color: "var(--warn)" }}>Your Google connection expired.</p>
          <a href="/api/google/connect?want=gmail" className="btn btn-sm btn-accent">Reconnect</a>
        </div>
      )}
      {r.state === "error" && <p className="small muted">Couldn&apos;t reach Gmail just now. It&apos;ll try again next time.</p>}
      {r.state === "ok" && (r.threads.length === 0 ? <p className="small muted">No unread emails in your Primary tab. 🎉</p> : (
        <div className="col" style={{ gap: 2 }}>
          {r.threads.map((t) => (
            <Link key={t.id} href={`/inbox/${t.id}`} className="mail-row mail-unread" style={{ gridTemplateColumns: "minmax(0, 1fr) auto", padding: "10px 8px" }}>
              <span style={{ minWidth: 0 }}>
                <span className="mail-from" style={{ display: "block" }}>{t.from}</span>
                <span className="small" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 400 }}>{t.subject}</span>
              </span>
              <span className="mail-time">{times[t.id]}</span>
            </Link>
          ))}
        </div>
      ))}
    </section>
  );
}
