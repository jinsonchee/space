import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { getSettings } from "@/lib/db";
import { calendarConfigured } from "@/lib/google";
import { listInbox } from "@/lib/gmail";
import { when } from "@/lib/when";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const me = await requireMember();
  const s = (await getSettings())!;
  const r = await listInbox(me.id);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Inbox</h1>
          <p className="muted">Your Gmail, Primary tab{r.state === "ok" && r.threads.some((t) => t.unread) ? ` · ${r.threads.filter((t) => t.unread).length} unread` : ""}</p>
        </div>
        {r.state === "ok" && <a className="btn btn-sm" href="https://mail.google.com/" target="_blank" rel="noreferrer">Open Gmail</a>}
      </div>
      {r.state === "off" && (
        <div className="card empty">
          <p style={{ fontWeight: 600, color: "var(--text)" }}>{calendarConfigured() ? "Connect your Gmail to see your inbox here" : "Gmail isn't set up for this Space yet"}</p>
          <p className="small" style={{ margin: "6px 0 14px" }}>{calendarConfigured() ? "Read emails, reply, and turn any email into a task for the team." : "Whoever set up this Space needs to add Google first."}</p>
          {calendarConfigured() && <a className="btn btn-accent" href="/api/google/connect?want=gmail">Connect Gmail</a>}
        </div>
      )}
      {r.state === "expired" && (
        <div className="card empty">
          <p style={{ fontWeight: 600, color: "var(--warn)" }}>Your Google connection expired.</p>
          <a className="btn btn-accent" style={{ marginTop: 12 }} href="/api/google/connect?want=gmail">Reconnect</a>
        </div>
      )}
      {r.state === "error" && <div className="card empty"><p>Couldn&apos;t reach Gmail just now. Refresh to try again.</p></div>}
      {r.state === "ok" && (
        r.threads.length === 0 ? <div className="card empty"><p>Inbox zero 🎉 Nothing in your Primary tab.</p></div> : (
          <div className="card mail-list">
            {r.threads.map((t) => (
              <Link key={t.id} href={`/inbox/${t.id}`} className={`mail-row ${t.unread ? "mail-unread" : ""}`}>
                <span className="mail-from">{t.from}{t.count > 1 && <span className="faint"> {t.count}</span>}</span>
                <span className="mail-main"><span className="mail-subject">{t.subject}</span><span className="mail-snippet"> — {t.snippet}</span></span>
                <span className="mail-time">{when(t.date, s.timezone)}</span>
              </Link>
            ))}
          </div>
        )
      )}
    </>
  );
}
