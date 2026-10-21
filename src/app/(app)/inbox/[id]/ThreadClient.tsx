"use client";
import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Attachment, GLabel, Message } from "@/lib/gmail";
import type { MemberLite, Label, GoalLite } from "@/lib/queries";
import { threadAction, discardMailDraft } from "../../../actions/gmail";
import { TaskModal } from "../../tasks/TaskModal";
import { Composer, esc, kb, type ComposeInit } from "../Composer";
import { UNDO_KEY } from "../InboxClient";
import { I } from "@/components/Icons";
import { PREVIEWABLE } from "@/lib/preview";

type Msg = Message & { when: string };
const addrEmail = (a: string) => (a.match(/<([^>]+)>/)?.[1] ?? a).trim().toLowerCase();
const splitAddrs = (v: string) => v.split(",").map((x) => x.trim()).filter(Boolean);
const LEAVE: Record<string, string> = { archive: "Archived", trash: "Moved to Trash", spam: "Reported as spam", untrash: "Restored", notspam: "Moved to Inbox", inbox: "Moved to Inbox" };

export default function ThreadClient({ threadId, subject, messages, threadLabels, mailLabels, account, gmailUrl, signature, members, labels, goals, meId }: {
  threadId: string; subject: string; messages: Msg[]; threadLabels: string[]; mailLabels: GLabel[]; account: string | null; gmailUrl: string; signature: string;
  members: MemberLite[]; labels: Label[]; goals: GoalLite[]; meId: string;
}) {
  const router = useRouter();
  const sent = messages.filter((m) => !m.draftId);
  const drafts = messages.filter((m) => m.draftId);
  const [open, setOpen] = useState<Set<string>>(() => new Set([sent[sent.length - 1]?.id]));
  const [compose, setCompose] = useState<ComposeInit | null>(null);
  const [task, setTask] = useState(false);
  const [note, setNote] = useState<{ t: string; bad?: boolean } | null>(null);
  const [preview, setPreview] = useState<Attachment | null>(null);
  const [starred, setStarred] = useState(threadLabels.includes("STARRED"));
  const [pending, start] = useTransition();
  const last = sent[sent.length - 1] ?? messages[messages.length - 1];
  const me = account?.toLowerCase() ?? "";
  const inTrash = threadLabels.includes("TRASH");
  const inSpam = threadLabels.includes("SPAM");
  const inInbox = threadLabels.includes("INBOX");

  // Who a reply goes to: the sender (or Reply-To); if I sent the last one, the people I wrote to.
  const recipients = (all: boolean) => {
    const fromMe = addrEmail(last.fromEmail) === me;
    const to = fromMe ? splitAddrs(last.to) : [last.replyTo || `${last.from} <${last.fromEmail}>`];
    const cc = all ? [...(fromMe ? [] : splitAddrs(last.to)), ...splitAddrs(last.cc)] : [];
    const seen = new Set(to.map(addrEmail));
    return { to: to.join(", "), cc: cc.filter((a) => { const e = addrEmail(a); if (e === me || seen.has(e)) return false; seen.add(e); return true; }).join(", ") };
  };
  const quote = { when: last.when, from: last.from, fromEmail: last.fromEmail, text: last.text };
  const reSubject = /^re:/i.test(subject) ? subject : `Re: ${subject}`;
  const replyInit = (all: boolean): ComposeInit => ({ mode: all ? "all" : "reply", ...recipients(all), subject: reSubject, threadId, inReplyTo: last.messageIdHeader, references: last.references, quote });
  const forwardInit = (): ComposeInit => ({
    mode: "forward",
    subject: /^fwd?:/i.test(subject) ? subject : `Fwd: ${subject}`,
    html: `<br><div>---------- Forwarded message ---------<br>From: ${esc(last.from)} &lt;${esc(last.fromEmail)}&gt;<br>Date: ${esc(last.when)}<br>Subject: ${esc(subject)}<br>To: ${esc(last.to)}</div><br><div>${esc(last.text).replace(/\n/g, "<br>")}</div>`,
    forwardFrom: `${threadId}:${last.id}`,
    forwardCount: last.attachments.length,
  });
  const draftInit = (d: Msg): ComposeInit => ({ mode: "draft", to: d.to, cc: d.cc, bcc: d.bcc, subject: d.subject, html: d.html ?? esc(d.text).replace(/\n/g, "<br>"), threadId, draftId: d.draftId, inReplyTo: last.messageIdHeader, references: last.references });

  const act = (action: string) => start(async () => {
    const r = await threadAction([threadId], action);
    if (!r.ok) return setNote({ t: r.error, bad: true });
    if (LEAVE[action] && action !== "untrash" && action !== "notspam" && action !== "inbox") {
      // Leave the conversation and show Undo on the Inbox page.
      try { sessionStorage.setItem(UNDO_KEY, JSON.stringify({ text: LEAVE[action], ids: [threadId], undo: r.undo })); } catch {}
      router.push("/inbox");
      return;
    }
    if (action.startsWith("label:")) {
      try { sessionStorage.setItem(UNDO_KEY, JSON.stringify({ text: `Moved to ${mailLabels.find((l) => l.id === action.slice(6))?.name ?? "label"}`, ids: [threadId], undo: r.undo })); } catch {}
      router.push("/inbox");
      return;
    }
    if (action === "unread") { router.push("/inbox"); return; }
    if (action === "star" || action === "unstar") setStarred(action === "star");
    setNote({ t: LEAVE[action] ?? "Done ✓" });
    router.refresh();
  });

  return (
    <>
      <div className="page-head" style={{ alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <Link href="/inbox" className="btn btn-sm btn-ghost" style={{ marginBottom: 8 }}><I.left style={{ width: 16 }} /> Inbox</Link>
          <h1 style={{ fontSize: 26 }}>{subject}</h1>
        </div>
      </div>

      <div className="card mail-toolbar" style={{ marginBottom: 12, flexWrap: "wrap", gap: 6, borderBottom: 0 }}>
        {inTrash ? <button className="btn btn-sm" disabled={pending} onClick={() => act("untrash")}>Restore</button> : <>
          {inInbox ? <button className="btn btn-sm" disabled={pending} onClick={() => act("archive")}>Archive</button> : !inSpam && <button className="btn btn-sm" disabled={pending} onClick={() => act("inbox")}>Move to Inbox</button>}
          <button className="btn btn-sm" disabled={pending} onClick={() => act("trash")}><I.trash style={{ width: 14 }} /> Delete</button>
        </>}
        <button className="btn btn-sm" disabled={pending} onClick={() => act("unread")}>Mark unread</button>
        <button className="btn btn-sm" disabled={pending} onClick={() => act(starred ? "unstar" : "star")}>{starred ? "★ Starred" : "☆ Star"}</button>
        {mailLabels.length > 0 && (
          <select className="select" style={{ height: 32, width: "auto", padding: "0 10px" }} value="" aria-label="Move to label" disabled={pending} onChange={(e) => e.target.value && act(`label:${e.target.value}`)}>
            <option value="">Move to…</option>
            {mailLabels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        )}
        {inSpam ? <button className="btn btn-sm" disabled={pending} onClick={() => act("notspam")}>Not spam</button> : !inTrash && <button className="btn btn-sm" disabled={pending} onClick={() => act("spam")}>Spam</button>}
        <span style={{ flex: 1 }} />
        <button className="btn btn-sm" onClick={() => setTask(true)}><I.tasks style={{ width: 15 }} /> Make a task</button>
        <a className="btn btn-sm btn-ghost" href={gmailUrl} target="_blank" rel="noreferrer">Open in Gmail</a>
      </div>
      {note && <p className="small" style={{ color: note.bad ? "var(--danger)" : "var(--success)", marginBottom: 12 }}>{note.t}</p>}

      {sent.map((m) => {
        const isOpen = open.has(m.id);
        return (
          <section key={m.id} className="card mail-msg">
            <button className="row between" style={{ width: "100%", background: "none", border: 0, padding: 0, color: "inherit", cursor: "pointer", textAlign: "left", gap: 10 }}
              onClick={() => setOpen((o) => { const n = new Set(o); if (n.has(m.id)) n.delete(m.id); else n.add(m.id); return n; })} aria-expanded={isOpen}>
              <span style={{ minWidth: 0 }}>
                <strong>{m.from}</strong> <span className="small muted">&lt;{m.fromEmail}&gt;</span>
                {!isOpen && <span className="small muted" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.text.slice(0, 140)}</span>}
              </span>
              <span className="small muted" style={{ whiteSpace: "nowrap" }}>{m.when}</span>
            </button>
            {isOpen && (
              <div style={{ marginTop: 12 }}>
                {m.to && <p className="tiny muted" style={{ marginBottom: 10 }}>To: {m.to}{m.cc ? ` · Cc: ${m.cc}` : ""}</p>}
                {m.html ? <MailFrame html={m.html} /> : <div className="mail-text">{m.text}</div>}
                {m.attachments.length > 0 && (
                  <div className="mail-attach">
                    {m.attachments.map((a) => (
                      <button key={a.attachmentId} type="button" className="chip" style={{ height: 32, cursor: "pointer" }} onClick={() => setPreview(a)}>
                        📎 {a.filename} <span className="faint">{kb(a.size)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        );
      })}

      {drafts.map((d) => compose?.draftId === d.draftId ? null : (
        <section key={d.id} className="card mail-msg" style={{ borderStyle: "dashed" }}>
          <div className="row between wrap" style={{ gap: 10 }}>
            <span className="small"><strong style={{ color: "var(--danger)" }}>Draft</strong> <span className="muted">{d.text.slice(0, 120) || "(empty)"}</span></span>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn btn-sm btn-accent" onClick={() => setCompose(draftInit(d))}>Continue editing</button>
              <button className="btn btn-sm btn-ghost" onClick={() => start(async () => { if (d.draftId) await discardMailDraft(d.draftId); router.refresh(); })}>Discard</button>
            </div>
          </div>
        </section>
      ))}

      <div style={{ marginTop: 14 }}>
        {compose ? (
          <Composer
            key={`${compose.mode}-${compose.draftId ?? ""}`}
            init={compose}
            signature={signature}
            gmailUrl={gmailUrl}
            onClose={() => setCompose(null)}
            onSent={(t) => { setCompose(null); setNote({ t }); }}
          />
        ) : sent.length > 0 && (
          <div className="row wrap" style={{ gap: 8 }}>
            <button className="btn btn-accent" onClick={() => setCompose(replyInit(false))}>Reply</button>
            {(splitAddrs(last.to).length + splitAddrs(last.cc).length > 1) && <button className="btn" onClick={() => setCompose(replyInit(true))}>Reply all</button>}
            <button className="btn" onClick={() => setCompose(forwardInit())}>Forward</button>
          </div>
        )}
      </div>

      {preview && <PreviewModal a={preview} onClose={() => setPreview(null)} />}

      {task && (
        <TaskModal
          task={null}
          draft={{ title: subject.replace(/^(re|fwd?):\s*/i, ""), description: `From: ${last.from} <${last.fromEmail}>\nOpen the email: ${gmailUrl}\n\n${last.text.slice(0, 600)}` }}
          members={members} labels={labels} goals={goals} meId={meId}
          onClose={() => setTask(false)}
          onSaved={() => setNote({ t: "Task created ✓ It's on the Tasks page." })}
        />
      )}
    </>
  );
}

/** Shows an email's HTML in a sealed frame: no scripts can run, links open in a new tab. */
function MailFrame({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const doc = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="script-src 'none'"><base target="_blank"><style>body{margin:16px;font:14px/1.5 -apple-system,Segoe UI,Inter,sans-serif;color:#111;word-wrap:break-word}img{max-width:100%;height:auto}</style></head><body>${html}</body></html>`;
  const fit = () => { const d = ref.current?.contentDocument; if (d?.body && ref.current) ref.current.style.height = `${d.documentElement.scrollHeight + 4}px`; };
  // allow-same-origin (without allow-scripts) only lets us measure the height; scripts stay blocked.
  return <iframe ref={ref} className="mail-frame" sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" srcDoc={doc} onLoad={() => { fit(); setTimeout(fit, 400); }} title="Email" />;
}

const attachUrl = (a: Attachment, view: boolean) =>
  `/api/google/attachment?${new URLSearchParams({ m: a.messageId, a: a.attachmentId, name: a.filename, t: a.mimeType, ...(view ? { view: "1" } : {}) })}`;

/** Look at an attachment first; download only if you want to keep it. */
function PreviewModal({ a, onClose }: { a: Attachment; onClose: () => void }) {
  const canView = PREVIEWABLE.has(a.mimeType);
  const isPdf = a.mimeType === "application/pdf";
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()} onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={a.filename} style={{ width: isPdf ? "min(960px, 100%)" : "min(820px, 100%)" }}>
        <div className="row between" style={{ gap: 10, marginBottom: 14 }}>
          <strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📎 {a.filename} <span className="small faint">{kb(a.size)}</span></strong>
          <div className="row" style={{ gap: 6 }}>
            <a className="btn btn-sm" href={attachUrl(a, false)}>Download</a>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close" autoFocus><I.x style={{ width: 16 }} /></button>
          </div>
        </div>
        {!canView ? (
          <div className="empty" style={{ padding: 40 }}><p>No preview for this kind of file.</p><p className="small" style={{ marginTop: 4 }}>Download it to open it on your device.</p></div>
        ) : isPdf ? (
          <iframe src={attachUrl(a, true)} title={a.filename} style={{ width: "100%", height: "70dvh", border: 0, borderRadius: 12, background: "#fff" }} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={attachUrl(a, true)} alt={a.filename} style={{ display: "block", maxWidth: "100%", maxHeight: "70dvh", margin: "0 auto", borderRadius: 12 }} />
        )}
      </div>
    </div>
  );
}

