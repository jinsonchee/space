import Link from "next/link";
import type { GmailResult, ThreadSummary } from "@/lib/gmail";
import { I } from "@/components/Icons";
import { tint, initial } from "@/lib/tint";

/** Home: unread count and the latest few unread emails. */
export default function InboxCard({ r, times }: { r: GmailResult<{ threads: ThreadSummary[]; estimate: number }> | { state: "connect" }; times: Record<string, string> }) {
  return (
    <section className="sec">
      <div className="sec-head">
        <h2>Inbox {r.state === "ok" && r.threads.length > 0 && <span className="sec-count">{r.estimate > r.threads.length ? `${r.estimate}+` : r.threads.length} unread</span>}</h2>
        {r.state === "ok" && <Link href="/inbox" className="sec-link">Open inbox <I.right style={{ width: 14 }} /></Link>}
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
        <ul className="home-mail">
          {r.threads.map((t) => (
            <li key={t.id}>
              <Link href={`/inbox/${t.id}`}>
                <span className="sender" style={{ background: tint(t.from) }} aria-hidden>{initial(t.from)}</span>
                <span className="home-mail-main">
                  <span className="home-mail-from">{t.from}</span>
                  <span className="home-mail-subject">{t.subject}</span>
                </span>
                <span className="home-mail-time">{times[t.id]}</span>
              </Link>
            </li>
          ))}
        </ul>
      ))}
    </section>
  );
}
