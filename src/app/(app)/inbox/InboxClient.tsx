"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from "motion/react";
import type { FolderKey, GLabel, TabKey, ThreadSummary } from "@/lib/gmail";
import { threadAction } from "../../actions/gmail";
import { Composer } from "./Composer";
import { I } from "@/components/Icons";
import { Toast } from "@/components/Toast";
import { useIsPhone } from "@/components/Sheet";
import { project } from "@/lib/motion";
import { tint, initial } from "@/lib/tint";

export type Folder = { key: FolderKey; name: string };
export type Tab = { key: TabKey; name: string };
type Undo = { text: string; ids: string[]; undo: string };

export const UNDO_KEY = "space_mail_undo"; // the conversation page hands its Undo to this page
export const ORDER_KEY = "space_mail_order"; // the conversation page uses this for its up/down arrows

const FOLDER_ICON: Partial<Record<FolderKey, keyof typeof I>> = { inbox: "inbox", starred: "star", sent: "nudge", drafts: "compose", spam: "spam", trash: "trash" };

export default function InboxClient(p: {
  startCompose?: boolean; groups: Record<string, string>; rail: React.ReactNode;
  threads: ThreadSummary[]; times: Record<string, string>; folders: Folder[]; tabs: Tab[]; labels: GLabel[]; inboxUnread: number;
  folder: FolderKey; tab: TabKey; label: string | null; q: string; nextPageToken: string | null; isFirstPage: boolean; signature: string;
}) {
  const router = useRouter();
  const phone = useIsPhone();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [selecting, setSelecting] = useState(false); // phone: "Select" mode shows the tick circles
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [over, setOver] = useState<Record<string, Partial<ThreadSummary>>>({});
  const [toast, setToast] = useState<Undo | { text: string; bad?: boolean } | null>(null);
  const [compose, setCompose] = useState(p.startCompose ?? false); // Home → "+ Email"
  const [search, setSearch] = useState(p.q);
  const [, start] = useTransition();

  // New page of results → clear selection and local changes.
  useEffect(() => { setSel(new Set()); setHidden(new Set()); setOver({}); }, [p.threads]);
  useEffect(() => {
    try { const u = sessionStorage.getItem(UNDO_KEY); if (u) { sessionStorage.removeItem(UNDO_KEY); setToast(JSON.parse(u)); } } catch {}
  }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 9000); return () => clearTimeout(t); }, [toast]);

  const rows = useMemo(() => p.threads.filter((t) => !hidden.has(t.id)).map((t) => ({ ...t, ...over[t.id] })), [p.threads, hidden, over]);
  // Remember the list order so a conversation can step to the next/previous email.
  useEffect(() => { try { sessionStorage.setItem(ORDER_KEY, JSON.stringify(rows.map((t) => t.id))); } catch {} }, [rows]);
  const allOn = rows.length > 0 && rows.every((t) => sel.has(t.id));
  const chosen = [...sel];
  const chosenRows = rows.filter((t) => sel.has(t.id));
  const plainInbox = p.folder === "inbox" && !p.q && !p.label;
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
    setSelecting(false);
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
  const title = p.q ? `Results for “${p.q}”` : p.label ? p.labels.find((l) => l.id === p.label)?.name ?? "Label" : p.folders.find((f) => f.key === p.folder)?.name ?? "Inbox";
  const fromCol = (t: ThreadSummary) => (p.folder === "sent" || p.folder === "drafts") && !p.q && !p.label ? `To: ${t.to || "—"}` : t.from;
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const showChecks = selecting || sel.size > 0;
  // The main "get it out of my way" action for this view.
  const away = inTrash ? "untrash" : plainInbox ? "archive" : p.folder === "spam" ? "notspam" : "inbox";
  const AWAY = { untrash: "Restore", archive: "Archive", notspam: "Not spam", inbox: "Move to Inbox" }[away];

  const doSearch = (e: React.FormEvent) => { e.preventDefault(); router.push(qs({ q: search.trim() || null })); };

  return (
    <div className={`inbox ${p.rail ? "has-rail" : ""}`}>
      {/* Folders (a dropdown on phones) */}
      <aside className="mail-nav">
        <button className="btn btn-accent hide-sm" style={{ width: "100%", marginBottom: 14 }} onClick={() => setCompose(true)}><I.compose style={{ width: 15 }} /> Compose</button>
        <nav className="mail-folders" aria-label="Mail folders">
          {p.folders.map((f) => {
            const Icon = I[FOLDER_ICON[f.key] ?? "mail"];
            return (
              <Link key={f.key} href={qs({ f: f.key === "inbox" ? null : f.key })} className={`mail-folder ${!p.q && !p.label && p.folder === f.key ? "on" : ""}`}>
                <Icon /><span>{f.name}</span>{f.key === "inbox" && p.inboxUnread > 0 && <span className="mail-count">{p.inboxUnread}</span>}
              </Link>
            );
          })}
          {p.labels.length > 0 && <div className="mail-nav-head">Labels</div>}
          {p.labels.map((l) => (
            <Link key={l.id} href={qs({ label: l.id })} className={`mail-folder ${p.label === l.id ? "on" : ""}`}><I.tag /><span>{l.name}</span></Link>
          ))}
        </nav>
      </aside>

      <section className="inbox-main">
        {/* Search (desktop; phones get it in the floating bar) */}
        <form className="inbox-search hide-sm" onSubmit={doSearch} role="search">
          <I.search />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search mail. Try from:gabe or has:attachment" aria-label="Search mail" />
          {p.q && <Link className="sec-link" href="/inbox" onClick={() => setSearch("")}>Clear</Link>}
        </form>

        <div className="inbox-bar">
          {/* Phone: folder picker. Desktop: Gmail's tabs, as plain text tabs. */}
          <select className="mail-folder-select" aria-label="Folder" value={p.label ? `label:${p.label}` : p.folder}
            onChange={(e) => router.push(e.target.value.startsWith("label:") ? qs({ label: e.target.value.slice(6) }) : qs({ f: e.target.value === "inbox" ? null : e.target.value }))}>
            {p.folders.map((f) => <option key={f.key} value={f.key}>{f.name}{f.key === "inbox" && p.inboxUnread ? ` (${p.inboxUnread})` : ""}</option>)}
            {p.labels.map((l) => <option key={l.id} value={`label:${l.id}`}>{l.name}</option>)}
          </select>
          {plainInbox ? (
            <nav className="inbox-tabs" role="tablist" aria-label="Inbox tabs">
              {p.tabs.map((t) => <Link key={t.key} role="tab" aria-selected={p.tab === t.key} href={qs({ tab: t.key === "primary" ? null : t.key })} className={p.tab === t.key ? "on" : ""}>{t.name}</Link>)}
            </nav>
          ) : <span className="inbox-title hide-sm">{title}</span>}
          <span style={{ flex: 1 }} />
          {rows.length > 0 && <button className="inbox-selbtn" onClick={() => { setSelecting((x) => !x); setSel(new Set()); }}>{selecting ? "Done" : "Select"}</button>}
        </div>

        {/* Bulk actions slide in once something is selected */}
        <AnimatePresence>
          {sel.size > 0 && (
            <motion.div className="inbox-select" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
              <label className="mrow-check"><input type="checkbox" aria-label="Select all" checked={allOn} onChange={() => setSel(allOn ? new Set() : new Set(rows.map((t) => t.id)))} /></label>
              <strong className="small">{sel.size} selected</strong>
              <div className="inbox-select-actions">
                <button className="ibtn" onClick={() => act(away)} title={AWAY} aria-label={AWAY}>{away === "archive" ? <I.archive /> : <I.inbox />}</button>
                {!inTrash && <button className="ibtn" onClick={() => act("trash")} title="Delete" aria-label="Delete"><I.trash /></button>}
                {chosenRows.some((t) => t.unread) ? <button className="ibtn" onClick={() => act("read")} title="Mark read" aria-label="Mark read"><I.mailOpen /></button> : <button className="ibtn" onClick={() => act("unread")} title="Mark unread" aria-label="Mark unread"><I.mail /></button>}
                <button className={`ibtn ${chosenRows.every((t) => t.starred) ? "on" : ""}`} onClick={() => act(chosenRows.every((t) => t.starred) ? "unstar" : "star")} title="Star" aria-label="Star"><I.star filled={chosenRows.every((t) => t.starred)} /></button>
                {!inSpam && !inTrash && <button className="ibtn" onClick={() => act("spam")} title="Report spam" aria-label="Report spam"><I.spam /></button>}
                {p.labels.length > 0 && (
                  <select className="select inbox-move" value="" aria-label="Move to label" onChange={(e) => e.target.value && act(`label:${e.target.value}`)}>
                    <option value="">Move to…</option>
                    {p.labels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                )}
              </div>
              <button className="ibtn" onClick={() => { setSel(new Set()); setSelecting(false); }} aria-label="Clear selection"><I.x /></button>
            </motion.div>
          )}
        </AnimatePresence>

        {rows.length === 0 ? (
          <div className="inbox-empty">
            <p style={{ fontWeight: 600, color: "var(--text)" }}>{p.q ? "No emails match that search." : plainInbox ? "Inbox zero 🎉" : "Nothing here."}</p>
            {plainInbox && <p className="small muted" style={{ marginTop: 4 }}>You&apos;re all caught up.</p>}
          </div>
        ) : (
          <div className={`mlist ${showChecks ? "selecting" : ""}`}>
            {rows.map((t, i) => {
              const g = p.groups[t.id];
              return (
                <div key={t.id}>
                  {g && g !== p.groups[rows[i - 1]?.id] && <div className="mail-day">{g}</div>}
                  <MailRow t={t} from={fromCol(t)} time={p.times[t.id]} picked={sel.has(t.id)} swipe={phone && !showChecks}
                    away={away} awayLabel={AWAY} canTrash={!inTrash}
                    onPick={() => toggle(t.id)} onAct={(a) => act(a, [t.id])} />
                </div>
              );
            })}
          </div>
        )}

        <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
          {!p.isFirstPage && <Link className="btn btn-sm" href={qs(here)}>Newest</Link>}
          {p.nextPageToken && <Link className="btn btn-sm" href={qs({ ...here, p: p.nextPageToken })}>Older <I.right style={{ width: 14 }} /></Link>}
        </div>
      </section>

      {p.rail && <aside className="inbox-rail">{p.rail}</aside>}

      {/* Phone: search + compose float at the bottom, within thumb reach */}
      <form className="inbox-float only-sm" onSubmit={doSearch} role="search">
        <label className="inbox-float-search"><I.search /><input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" aria-label="Search mail" /></label>
        <button type="button" className="inbox-float-compose" onClick={() => setCompose(true)} aria-label="Compose"><I.compose /></button>
      </form>

      <AnimatePresence>{compose && <Composer floating init={{ mode: "new" }} signature={p.signature} onClose={() => setCompose(false)} onSent={(m) => { setCompose(false); setToast({ text: m }); }} />}</AnimatePresence>

      <Toast show={!!toast} edge="bottom" className="mail-toast">
        {toast && <>
          <span style={{ color: "bad" in toast && toast.bad ? "var(--danger)" : undefined }}>{toast.text}</span>
          {"undo" in toast && <button className="btn btn-sm" onClick={() => undo(toast)}>Undo</button>}
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setToast(null)} aria-label="Dismiss"><I.x style={{ width: 14 }} /></button>
        </>}
      </Toast>
    </div>
  );
}

/**
 * One email row. Desktop: quick actions appear on hover in place of the time.
 * Phone: swipe left to archive (or delete outside the Inbox), swipe right to mark read/unread.
 */
function MailRow({ t, from, time, picked, swipe, away, awayLabel, canTrash, onPick, onAct }: {
  t: ThreadSummary; from: string; time: string; picked: boolean; swipe: boolean; away: string; awayLabel: string; canTrash: boolean;
  onPick: () => void; onAct: (a: string) => void;
}) {
  const x = useMotionValue(0);
  const dragged = useRef(false);
  const leftOn = useTransform(x, [-110, -40, 0], [1, 0.4, 0]);
  const rightOn = useTransform(x, [0, 40, 110], [0, 0.4, 1]);
  const W = 110; // how far to drag before letting go commits
  const onDragEnd = (_: unknown, info: PanInfo) => {
    const end = info.offset.x + project(info.velocity.x, 0.99);
    if (end < -W && info.velocity.x <= 0) onAct(away);
    else if (end > W && info.velocity.x >= 0) onAct(t.unread ? "read" : "unread");
    setTimeout(() => { dragged.current = false; }, 0);
  };
  return (
    <div className={`mrow ${t.unread ? "unread" : ""} ${picked ? "picked" : ""}`}>
      {swipe && <>
        <motion.span className="mrow-under right" style={{ opacity: rightOn }} aria-hidden>{t.unread ? <I.mailOpen /> : <I.mail />}{t.unread ? "Read" : "Unread"}</motion.span>
        <motion.span className="mrow-under left" style={{ opacity: leftOn }} aria-hidden>{awayLabel}{away === "archive" ? <I.archive /> : <I.inbox />}</motion.span>
      </>}
      <motion.div className="mrow-inner" style={{ x }}
        drag={swipe ? "x" : false} dragConstraints={{ left: 0, right: 0 }} dragElastic={0.9} dragSnapToOrigin
        onDragStart={() => { dragged.current = true; }} onDragEnd={onDragEnd}>
        <label className="mrow-check" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Select ${t.subject}`} checked={picked} onChange={onPick} /></label>
        <span className="mrow-av" style={{ background: tint(from) }} aria-hidden>{initial(from)}</span>
        <Link href={`/inbox/${t.id}`} className="mrow-link" draggable={false} onClickCapture={(e) => { if (dragged.current) e.preventDefault(); }}>
          <span className="mrow-from">{from}{t.count > 1 && <span className="mrow-n">{t.count}</span>}</span>
          <span className="mrow-main">
            {t.labels.includes("DRAFT") && <span className="mrow-draft">Draft</span>}
            <span className="mrow-subject">{t.subject}</span>
            <span className="mrow-snippet">{t.snippet}</span>
          </span>
          <span className="mrow-time">{t.starred && <I.star filled className="mrow-star" />}{time}</span>
        </Link>
        <span className="mrow-actions">
          <button className="ibtn" onClick={() => onAct(away)} title={awayLabel} aria-label={awayLabel}>{away === "archive" ? <I.archive /> : <I.inbox />}</button>
          {canTrash && <button className="ibtn" onClick={() => onAct("trash")} title="Delete" aria-label="Delete"><I.trash /></button>}
          <button className="ibtn" onClick={() => onAct(t.unread ? "read" : "unread")} title={t.unread ? "Mark read" : "Mark unread"} aria-label={t.unread ? "Mark read" : "Mark unread"}>{t.unread ? <I.mailOpen /> : <I.mail />}</button>
          <button className={`ibtn ${t.starred ? "on" : ""}`} onClick={() => onAct(t.starred ? "unstar" : "star")} title={t.starred ? "Unstar" : "Star"} aria-label={t.starred ? "Unstar" : "Star"}><I.star filled={t.starred} /></button>
        </span>
      </motion.div>
    </div>
  );
}
