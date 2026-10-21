"use client";
import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Message } from "@/lib/gmail";
import type { MemberLite, Label, GoalLite } from "@/lib/queries";
import { sendGmailReply } from "../../../actions/gmail";
import { TaskModal } from "../../tasks/TaskModal";
import { I } from "@/components/Icons";
import { PREVIEWABLE } from "@/lib/preview";
import type { Attachment } from "@/lib/gmail";

type Msg = Message & { when: string };
const MAX = 4 * 1024 * 1024;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const addrEmail = (a: string) => (a.match(/<([^>]+)>/)?.[1] ?? a).trim().toLowerCase();
const splitAddrs = (v: string) => v.split(",").map((x) => x.trim()).filter(Boolean);
const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default function ThreadClient({ threadId, subject, messages, account, gmailUrl, members, labels, goals, meId }: {
  threadId: string; subject: string; messages: Msg[]; account: string | null; gmailUrl: string;
  members: MemberLite[]; labels: Label[]; goals: GoalLite[]; meId: string;
}) {
  const [open, setOpen] = useState<Set<string>>(() => new Set([messages[messages.length - 1]?.id]));
  const [reply, setReply] = useState<"reply" | "all" | null>(null);
  const [task, setTask] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [preview, setPreview] = useState<Attachment | null>(null);
  const last = messages[messages.length - 1];
  const me = account?.toLowerCase() ?? "";

  // Who a reply goes to: the sender (or Reply-To); if I sent the last one, the people I wrote to.
  const recipients = (all: boolean) => {
    const fromMe = addrEmail(last.fromEmail) === me;
    const to = fromMe ? splitAddrs(last.to) : [last.replyTo || `${last.from} <${last.fromEmail}>`];
    const cc = all ? [...(fromMe ? [] : splitAddrs(last.to)), ...splitAddrs(last.cc)] : [];
    const seen = new Set(to.map(addrEmail));
    return { to: to.join(", "), cc: cc.filter((a) => { const e = addrEmail(a); if (e === me || seen.has(e)) return false; seen.add(e); return true; }).join(", ") };
  };

  return (
    <>
      <div className="page-head">
        <div style={{ minWidth: 0 }}>
          <Link href="/inbox" className="btn btn-sm btn-ghost" style={{ marginBottom: 8 }}><I.left style={{ width: 16 }} /> Inbox</Link>
          <h1 style={{ fontSize: 26 }}>{subject}</h1>
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          <button className="btn btn-sm" onClick={() => setTask(true)}><I.tasks style={{ width: 15 }} /> Make a task</button>
          <a className="btn btn-sm" href={gmailUrl} target="_blank" rel="noreferrer">Open in Gmail</a>
        </div>
      </div>
      {note && <p className="small" style={{ color: "var(--success)", marginBottom: 12 }}>{note}</p>}

      {messages.map((m) => {
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

      <div style={{ marginTop: 14 }}>
        {reply ? (
          <Composer
            key={reply}
            threadId={threadId}
            subject={/^re:/i.test(subject) ? subject : `Re: ${subject}`}
            {...recipients(reply === "all")}
            last={last}
            gmailUrl={gmailUrl}
            onClose={() => setReply(null)}
            onSent={() => { setReply(null); setNote("Sent from your Gmail ✓"); }}
          />
        ) : (
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-accent" onClick={() => setReply("reply")}>Reply</button>
            {(splitAddrs(last.to).length + splitAddrs(last.cc).length > 1) && <button className="btn" onClick={() => setReply("all")}>Reply all</button>}
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
          onSaved={() => setNote("Task created ✓ It's on the Tasks page.")}
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

type Picked = { id: number; file: File; ready: boolean };

function Composer({ threadId, subject, to: initialTo, cc: initialCc, last, gmailUrl, onClose, onSent }: {
  threadId: string; subject: string; to: string; cc: string; last: Msg; gmailUrl: string; onClose: () => void; onSent: () => void;
}) {
  const router = useRouter();
  const editor = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [to, setTo] = useState(initialTo);
  const [cc, setCc] = useState(initialCc);
  const [files, setFiles] = useState<Picked[]>([]);
  const [quote, setQuote] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const total = files.reduce((n, f) => n + f.file.size, 0);
  const tooBig = total > MAX;
  const reading = files.some((f) => !f.ready);
  const cmd = (c: string, v?: string) => { editor.current?.focus(); document.execCommand(c, false, v); };
  const keep = (e: React.MouseEvent) => e.preventDefault(); // keep the text selection when clicking a format button

  // A file shows "Attached ✓" once it has been fully read and is ready to send.
  const addFiles = (list: FileList | null) => {
    Array.from(list ?? []).forEach((file) => {
      const id = Math.random();
      setFiles((f) => [...f, { id, file, ready: false }]);
      file.arrayBuffer().then(() => setFiles((f) => f.map((x) => (x.id === id ? { ...x, ready: true } : x))));
    });
  };

  const send = () => start(async () => {
    setErr(null);
    const body = editor.current;
    if (!body || !body.innerText.trim()) return setErr("Write something first.");
    if (tooBig) return setErr("Attachments are over 4 MB.");
    const quoteText = quote ? `\n\nOn ${last.when}, ${last.from} <${last.fromEmail}> wrote:\n${last.text.split("\n").map((l) => `> ${l}`).join("\n")}` : "";
    const quoteHtml = quote ? `<br><div>On ${esc(last.when)}, ${esc(last.from)} &lt;${esc(last.fromEmail)}&gt; wrote:</div><blockquote style="margin:0 0 0 .8ex;border-left:1px solid #ccc;padding-left:1ex">${esc(last.text).replace(/\n/g, "<br>")}</blockquote>` : "";
    const fd = new FormData();
    fd.set("threadId", threadId); fd.set("to", to); fd.set("cc", cc); fd.set("subject", subject);
    fd.set("html", `<div>${body.innerHTML}</div>${quoteHtml}`); fd.set("text", body.innerText + quoteText);
    fd.set("inReplyTo", last.messageIdHeader); fd.set("references", last.references);
    files.forEach((f) => fd.append("files", f.file));
    const r = await sendGmailReply(fd);
    if (!r.ok) return setErr(r.error);
    router.refresh();
    onSent();
  });

  return (
    <section className="card composer">
      <div className="col" style={{ gap: 6, marginBottom: 8 }}>
        <label className="row small" style={{ gap: 8 }}><span className="muted" style={{ width: 28 }}>To</span><input className="input" style={{ height: 36 }} value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <label className="row small" style={{ gap: 8 }}><span className="muted" style={{ width: 28 }}>Cc</span><input className="input" style={{ height: 36 }} value={cc} onChange={(e) => setCc(e.target.value)} placeholder="Optional" /></label>
      </div>

      <div ref={editor} className="editor" contentEditable={!pending} suppressContentEditableWarning data-placeholder="Write your reply…" role="textbox" aria-multiline="true" aria-label="Reply" />

      {files.length > 0 && (
        <div className="col" style={{ gap: 6, marginTop: 10 }}>
          {files.map((f) => (
            <div key={f.id} className="attach-row">
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📎 {f.file.name} <span className="faint">{kb(f.file.size)}</span></span>
              <span className="small" style={{ color: pending ? "var(--muted)" : f.ready ? "var(--success)" : "var(--muted)", whiteSpace: "nowrap" }}>
                {pending ? "Sending…" : f.ready ? "✓ Attached" : "Adding…"}
              </span>
              {!pending && <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => setFiles((x) => x.filter((y) => y.id !== f.id))} aria-label={`Remove ${f.file.name}`}><I.x style={{ width: 14 }} /></button>}
            </div>
          ))}
          <span className="tiny" style={{ color: tooBig ? "var(--danger)" : "var(--muted)" }}>{kb(total)} of 4 MB</span>
        </div>
      )}
      {tooBig && <p className="small" style={{ marginTop: 8, color: "var(--danger)" }}>Too big for Space (4 MB max). Remove a file, or <a href={gmailUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>send this reply from Gmail</a>.</p>}
      {err && <p className="small" style={{ marginTop: 8, color: "var(--danger)" }}>{err}</p>}

      {/* Like Gmail: formatting just under the text, then Send + attach/link together, discard on the right. */}
      <div className="editor-bar" role="toolbar" aria-label="Formatting">
        <button type="button" onMouseDown={keep} onClick={() => cmd("bold")} aria-label="Bold" title="Bold"><b>B</b></button>
        <button type="button" onMouseDown={keep} onClick={() => cmd("italic")} aria-label="Italic" title="Italic"><i>I</i></button>
        <button type="button" onMouseDown={keep} onClick={() => cmd("underline")} aria-label="Underline" title="Underline"><u>U</u></button>
        <span className="editor-sep" />
        <button type="button" onMouseDown={keep} onClick={() => cmd("insertUnorderedList")} aria-label="Bulleted list" title="Bulleted list">• ≡</button>
        <button type="button" onMouseDown={keep} onClick={() => cmd("insertOrderedList")} aria-label="Numbered list" title="Numbered list">1. ≡</button>
      </div>
      <div className="row between wrap" style={{ gap: 8, marginTop: 10 }}>
        <div className="row" style={{ gap: 4 }}>
          <button className="btn btn-accent" onClick={send} disabled={pending || tooBig || reading}>{pending ? "Sending…" : "Send"}</button>
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => fileInput.current?.click()} disabled={pending} aria-label="Attach files" title="Attach files">📎</button>
          <button type="button" className="btn btn-ghost btn-icon" onMouseDown={keep} disabled={pending} aria-label="Insert link" title="Insert link"
            onClick={() => { const u = prompt("Link address (https://…)"); if (u && /^(https?:|mailto:)/i.test(u)) cmd("createLink", u); }}>🔗</button>
          <input ref={fileInput} type="file" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          <label className="row tiny muted" style={{ gap: 6, marginLeft: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={quote} onChange={(e) => setQuote(e.target.checked)} /> Include the previous email
          </label>
        </div>
        <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} disabled={pending} aria-label="Discard reply" title="Discard reply"><I.trash style={{ width: 16 }} /></button>
      </div>
    </section>
  );
}
