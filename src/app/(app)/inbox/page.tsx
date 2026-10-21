import { requireMember } from "@/lib/auth";
import { getSettings, sql } from "@/lib/db";
import { calendarConfigured } from "@/lib/google";
import { FOLDERS, TABS, getLabels, listThreads, type FolderKey, type TabKey } from "@/lib/gmail";
import { when } from "@/lib/when";
import InboxClient from "./InboxClient";

export const dynamic = "force-dynamic";

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ f?: string; tab?: string; label?: string; q?: string; p?: string }> }) {
  const me = await requireMember();
  const sp = await searchParams;
  const folder = (FOLDERS.find((f) => f.key === sp.f)?.key ?? "inbox") as FolderKey;
  const tab = (TABS.find((t) => t.key === sp.tab)?.key ?? "primary") as TabKey;
  const [s, r, labels, [sig]] = await Promise.all([
    getSettings(),
    listThreads(me.id, { folder, tab, label: sp.label, q: sp.q, pageToken: sp.p }),
    getLabels(me.id),
    sql<{ email_signature: string }[]>`select email_signature from members where id = ${me.id}`,
  ]);

  if (r.state !== "ok") {
    return (
      <>
        <div className="page-head"><div><h1>Inbox</h1><p className="muted">Your Gmail, inside Space</p></div></div>
        <div className="card empty">
          {r.state === "off" ? <>
            <p style={{ fontWeight: 600, color: "var(--text)" }}>{calendarConfigured() ? "Connect your Gmail to see your inbox here" : "Gmail isn't set up for this Space yet"}</p>
            <p className="small" style={{ margin: "6px 0 14px" }}>{calendarConfigured() ? "Read, reply, organise, and turn any email into a task for the team." : "Whoever set up this Space needs to add Google first."}</p>
            {calendarConfigured() && <a className="btn btn-accent" href="/api/google/connect?want=gmail">Connect Gmail</a>}
          </> : r.state === "expired" ? <>
            <p style={{ fontWeight: 600, color: "var(--warn)" }}>Your Google connection expired.</p>
            <a className="btn btn-accent" style={{ marginTop: 12 }} href="/api/google/connect?want=gmail">Reconnect</a>
          </> : <p>Couldn&apos;t reach Gmail just now. Refresh to try again.</p>}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <div><h1>Inbox</h1><p className="muted">Your Gmail, inside Space</p></div>
        <a className="btn btn-sm btn-ghost" href="https://mail.google.com/" target="_blank" rel="noreferrer">Open Gmail</a>
      </div>
      <InboxClient
        threads={r.threads}
        times={Object.fromEntries(r.threads.map((t) => [t.id, when(t.date, s!.timezone)]))}
        folders={FOLDERS.map((f) => ({ key: f.key, name: f.name }))}
        tabs={TABS.map((t) => ({ key: t.key, name: t.name }))}
        labels={labels.labels}
        inboxUnread={labels.inboxUnread}
        folder={folder}
        tab={tab}
        label={sp.label ?? null}
        q={sp.q ?? ""}
        nextPageToken={r.nextPageToken}
        isFirstPage={!sp.p}
        signature={sig?.email_signature ?? ""}
      />
    </>
  );
}
