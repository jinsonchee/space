"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FolderKey, GLabel, TabKey, ThreadSummary } from "@/lib/gmail";
import { threadAction } from "../../actions/gmail";
import { Composer } from "./Composer";
import { I } from "@/components/Icons";

export type Folder = { key: FolderKey; name: string };
export type Tab = { key: TabKey; name: string };
type Undo = { text: string; ids: string[]; undo: string };

export const UNDO_KEY = "space_mail_undo"; // the conversation page hands its Undo to this page

export default function InboxClient(p: {
  threads: ThreadSummary[]; times: Record<string, string>; folders: Folder[]; tabs: Tab[]; labels: GLabel[]; inboxUnread: number;
  folder: FolderKey; tab: TabKey; label: string | null; q: string; nextPageToken: string | null; isFirstPage: boolean; signature: string;
}) {
  const router = useRouter();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [over, setOver] = useState<Record<string, Partial<ThreadSummary>>>({});
  const [toast, setToast] = useState<Undo | { text: string; bad?: boolean } | null>(null);
  const [compose, setCompose] = useState(false);
  const [search, setSearch] = useState(p.q);
  const [, start] = useTransition();

  // New page of results → clear selection and local changes.
  useEffect(() => { setSel(new Set()); setHidden(new Set()); setOver({}); }, [p.threads]);
  useEffect(() => {
    try { const u = sessionStorage.getItem(UNDO_KEY); if (u) { sessionStorage.removeItem(UNDO_KEY); setToast(JSON.parse(u)); } } catch {}
  }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 9000); return () => clearTimeout(t); }, [toast]);

  const rows = useMemo(() => p.threads.filter((t) => !hidden.has(t.id)).map((t) => ({ ...t, ...over[t.id] })), [p.threads, hidden, over]);
  const allOn = rows.length > 0 && rows.every((t) => sel.has(t.id));
  const chosen = [...sel];
  const chosenRows = rows.filter((t) => sel.has(t.id));
  const inTrash = p.folder === "trash" && !p.q && !p.label;
  const inSpam = p.folder === "spam" && !p.q && !p.label;

  // Things that take emails out of the current view disappear straight away (with Undo).
  const leavesView = (a: string) => a === "trash" || a === "untrash" || a === "spam" || a === "notspam" || a.startsWith("label:") || (a === "archive" && p.folder === "inbox") || (a === "unstar" && p.folder === "starred");
  const LABEL: Record<string, string> = { read: "Marked as read", unread: "Marked as unread", archive: "Archived", inbox: "Moved to Inbox", star: "Starred", unstar: "Star removed", spam: "Reported as spam", notspam: "Moved to Inbox", trash: "Moved to Trash", untrash: "Restored" };

  const act = (action: string, ids = chosen) => {
    if (!ids.length) return;
    const n = ids.length;
    if (leavesView(action)) setHidden((h) => new Set([...h, ...ids]));
    else setOver((o) => ({ ...o, ...Object.fromEntries(ids.map((id) => [id, { ...o[id], ...(action === "read" ? { unread: false } : action === "unread" ? { unread: true } : action === "star" ? { starred: true } : action === "unstar" ? { starred: false } : {}) }])) }));
    setSel(new Set());
    start(async () => {
      const r = await threadAction(ids, action);
      if (!r.ok) { setHidden(new Set()); setOver({}); setToast({ text: r.error, bad: true }); return; }
      const what = action.startsWith("label:") ? `Moved to ${p.labels.find((l) => l.id === action.slice(6))?.name ?? "label"}` : LABEL[action] ?? "Done";
      setToast({ text: `${what}${n > 1 ? ` · ${n} conversations` : ""}`, ids, undo: r.undo });
      router.refresh();
    });
  };

  const undo = (u: Undo) => start(async () => {
    setToast(null);
    await threadAction(u.ids, u.undo);
    setHidden(new Set()); setOver({});
    router.refresh();
  });

  const qs = (o: Record<string, string | null | undefined>) => {
    const s = new URLSearchParams();
    Object.entries(o).forEach(([k, v]) => v && s.set(k, v));
    const str = s.toString();
    return `/inbox${str ? `?${str}` : ""}`;
  };
  const here = { f: p.label || p.q ? null : p.folder === "inbox" ? null : p.folder, tab: !p.label && !p.q && p.folder === "inbox" && p.tab !== "primary" ? p.tab : null, label: p.label, q: p.q || null };
  const title = p.q ? `Search: ${p.q}` : p.label ? p.labels.find((l) => l.id === p.label)?.name ?? "Label" : p.folders.find((f) => f.key === p.folder)?.name ?? "Inbox";
  const fromCol = (t: ThreadSummary) => (p.folder === "sent" || p.folder === "drafts") && !p.q && !p.label ? `To: ${t.to || "—"}` : t.from;

  return (
    <div className="mailbox">
      {/* Folder list (a dropdown on phones) */}
      <aside className="mail-nav">
        <button className="btn btn-accent" style={{ width: "100%", marginBottom: 12 }} onClick={() => setCompose(true)}><I.plus style={{ width: 16 }} /> Compose</button>
        <nav className="mail-folders" aria-label="Mail folders">
          {p.folders.map((f) => (
            <Link key={f.key} href={qs({ f: f.key === "inbox" ? null : f.key })} className={`mail-folder ${!p.q && !p.label && p.folder === f.key ? "on" : ""}`}>
              <span>{f.name}</span>{f.key === "inbox" && p.inboxUnread > 0 && <span className="mail-count">{p.inboxUnread}</span>}
            </Link>
          ))}
          {p.labels.length > 0 && <div className="tiny muted" style={{ fontWeight: 700, margin: "14px 10px 6px" }}>LABELS</div>}
          {p.labels.map((l) => (
            <Link key={l.id} href={qs({ label: l.id })} className={`mail-folder ${p.label === l.id ? "on" : ""}`}><span>🏷 {l.name}</span></Link>
          ))}
        </nav>
        <select className="select mail-folder-select" aria-label="Folder" value={p.label ? `label:${p.label}` : p.folder}
          onChange={(e) => router.push(e.target.value.startsWith("label:") ? qs({ label: e.target.value.slice(6) }) : qs({ f: e.target.value === "inbox" ? null : e.target.value }))}>
          {p.folders.map((f) => <option key={f.key} value={f.key}>{f.name}{f.key === "inbox" && p.inboxUnread ? ` (${p.inboxUnread})` : ""}</option>)}
          {p.labels.map((l) => <option key={l.id} value={`label:${l.id}`}>🏷 {l.name}</option>)}
        </select>
      </aside>

      <section style={{ minWidth: 0 }}>
        <form className="row" style={{ gap: 8, marginBottom: 12 }} onSubmit={(e) => { e.preventDefault(); router.push(qs({ q: search.trim() || null })); }}>
          <input className="input" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search mail — try from:gabe or has:attachment" aria-label="Search mail" />
          <button className="btn">Search</button>
          {p.q && <Link className="btn btn-ghost" href="/inbox" onClick={() => setSearch("")}>Clear</Link>}
        </form>

        {!p.q && !p.label && p.folder === "inbox" && (
          <div className="seg" style={{ marginBottom: 12 }} role="tablist">
            {p.tabs.map((t) => <Link key={t.key} role="tab" aria-selected={p.tab === t.key} href={qs({ tab: t.key === "primary" ? null : t.key })} className={`seg-link ${p.tab === t.key ? "on" : ""}`}>{t.name}</Link>)}
          </div>
        )}

        <div className="card mail-list">
          <div className="mail-toolbar">
            <input type="checkbox" aria-label="Select all" checked={allOn} onChange={() => setSel(allOn ? new Set() : new Set(rows.map((t) => t.id)))} />
            {sel.size === 0 ? (
              <span className="small muted" style={{ fontWeight: 600 }}>{title}</span>
            ) : (
              <div className="row wrap" style={{ gap: 4 }}>
                <span className="small" style={{ fontWeight: 600, marginRight: 6 }}>{sel.size} selected</span>
                {inTrash ? <button className="btn btn-sm" onClick={() => act("untrash")}>Restore</button> : <>
                  {p.folder === "inbox" && !p.q && !p.label ? <button className="btn btn-sm" onClick={() => act("archive")}>Archive</button> : <button className="btn btn-sm" onClick={() => act("inbox")}>Move to Inbox</button>}
                  <button className="btn btn-sm" onClick={() => act("trash")}><I.trash style={{ width: 14 }} /> Delete</button>
                </>}
                {chosenRows.some((t) => t.unread) ? <button className="btn btn-sm" onClick={() => act("read")}>Mark read</button> : <button className="btn btn-sm" onClick={() => act("unread")}>Mark unread</button>}
                {chosenRows.every((t) => t.starred) ? <button className="btn btn-sm" onClick={() => act("unstar")}>☆ Unstar</button> : <button className="btn btn-sm" onClick={() => act("star")}>★ Star</button>}
                {p.labels.length > 0 && (
                  <select className="select" style={{ height: 32, width: "auto", padding: "0 10px" }} value="" aria-label="Move to label" onChange={(e) => e.target.value && act(`label:${e.target.value}`)}>
                    <option value="">Move to…</option>
                    {p.labels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                )}
                {inSpam ? <button className="btn btn-sm" onClick={() => act("notspam")}>Not spam</button> : !inTrash && <button className="btn btn-sm" onClick={() => act("spam")}>Spam</button>}
              </div>
            )}
          </div>

          {rows.length === 0 ? (
            <div className="empty" style={{ padding: 40 }}><p>{p.q ? "No emails match that search." : p.folder === "inbox" && !p.label ? "Inbox zero 🎉" : "Nothing here."}</p></div>
          ) : rows.map((t) => (
            <div key={t.id} className={`mail-row mail-row-sel ${t.unread ? "mail-unread" : ""} ${sel.has(t.id) ? "mail-picked" : ""}`}>
              <input type="checkbox" aria-label={`Select ${t.subject}`} checked={sel.has(t.id)} onChange={() => setSel((s) => { const n = new Set(s); if (n.has(t.id)) n.delete(t.id); else n.add(t.id); return n; })} />
              <button className={`mail-star ${t.starred ? "on" : ""}`} aria-label={t.starred ? "Unstar" : "Star"} onClick={() => act(t.starred ? "unstar" : "star", [t.id])}>{t.starred ? "★" : "☆"}</button>
              <Link href={`/inbox/${t.id}`} className="mail-row-link">
                <span className="mail-from">{fromCol(t)}{t.count > 1 && <span className="faint"> {t.count}</span>}</span>
                <span className="mail-main">
                  {t.labels.includes("DRAFT") && <span style={{ color: "var(--danger)" }}>Draft </span>}
                  <span className="mail-subject">{t.subject}</span><span className="mail-snippet"> — {t.snippet}</span>
                </span>
                <span className="mail-time">{p.times[t.id]}</span>
              </Link>
            </div>
          ))}
        </div>

        <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
          {!p.isFirstPage && <Link className="btn btn-sm" href={qs(here)}>Newest</Link>}
          {p.nextPageToken && <Link className="btn btn-sm" href={qs({ ...here, p: p.nextPageToken })}>Older <I.right style={{ width: 14 }} /></Link>}
        </div>
      </section>

      {compose && <Composer floating init={{ mode: "new" }} signature={p.signature} onClose={() => setCompose(false)} onSent={(m) => { setCompose(false); setToast({ text: m }); }} />}

      {toast && (
        <div className="mail-toast" role="status">
          <span style={{ color: "bad" in toast && toast.bad ? "var(--danger)" : undefined }}>{toast.text}</span>
          {"undo" in toast && <button className="btn btn-sm" onClick={() => undo(toast)}>Undo</button>}
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setToast(null)} aria-label="Dismiss"><I.x style={{ width: 14 }} /></button>
        </div>
      )}
    </div>
  );
}
