"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { sendMail, saveMailDraft, discardMailDraft } from "../../actions/gmail";
import { I } from "@/components/Icons";

const MAX = 4 * 1024 * 1024;
const UNDO_SECONDS = 5;
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const textToHtml = (t: string) => esc(t).replace(/\n/g, "<br>");

/** Removes anything that could run code before HTML goes into the editor (drafts come from Gmail). */
function sanitize(html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script,style,iframe,object,embed,link,meta,form,input,button,textarea,select,svg,math,base").forEach((n) => n.remove());
  doc.querySelectorAll("*").forEach((el) => {
    for (const a of Array.from(el.attributes)) {
      const v = a.value.trim().toLowerCase();
      if (a.name.startsWith("on") || ((a.name === "href" || a.name === "src") && (v.startsWith("javascript:") || v.startsWith("data:text")))) el.removeAttribute(a.name);
    }
  });
  return doc.body.innerHTML;
}

export type ComposeInit = {
  mode: "new" | "reply" | "all" | "forward" | "draft";
  to?: string; cc?: string; bcc?: string; subject?: string;
  html?: string; // starting body (already safe text-as-HTML or a draft to sanitize)
  threadId?: string; inReplyTo?: string; references?: string;
  draftId?: string | null;
  forwardFrom?: string; // "threadId:messageId" — brings the original attachments along
  forwardCount?: number; // how many attachments the original has
  quote?: { when: string; from: string; fromEmail: string; text: string };
};

type Picked = { id: number; file: File; ready: boolean };

export function Composer({ init, signature, gmailUrl, floating, onClose, onSent }: {
  init: ComposeInit; signature: string; gmailUrl?: string; floating?: boolean; onClose: () => void; onSent: (msg: string) => void;
}) {
  const router = useRouter();
  const editor = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [to, setTo] = useState(init.to ?? "");
  const [cc, setCc] = useState(init.cc ?? "");
  const [bcc, setBcc] = useState(init.bcc ?? "");
  const [showCc, setShowCc] = useState(Boolean(init.cc || init.bcc));
  const [subject, setSubject] = useState(init.subject ?? "");
  const [files, setFiles] = useState<Picked[]>([]);
  const [quote, setQuote] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(init.draftId ?? null);
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const dirty = useRef(false);
  const sentOnce = useRef(false); // guards against sending twice if the page re-renders mid-send
  const firstRun = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showSubject = init.mode === "new" || init.mode === "forward" || init.mode === "draft";

  // Starting text: the draft or forwarded text, with the signature underneath for new writing.
  useEffect(() => {
    if (!editor.current) return;
    const sig = signature.trim() && init.mode !== "draft" ? `<br><div class="sig">--<br>${textToHtml(signature.trim())}</div>` : "";
    editor.current.innerHTML = `${init.mode === "draft" ? sanitize(init.html ?? "") : `<div><br></div>${sig}${init.html ?? ""}`}`;
    editor.current.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = files.reduce((n, f) => n + f.file.size, 0);
  const tooBig = total > MAX;
  const reading = files.some((f) => !f.ready);
  const cmd = (c: string, v?: string) => { editor.current?.focus(); document.execCommand(c, false, v); };
  const keep = (e: React.MouseEvent) => e.preventDefault();

  const build = useCallback(() => {
    const body = editor.current;
    const q = quote && init.quote;
    const quoteText = q ? `\n\nOn ${q.when}, ${q.from} <${q.fromEmail}> wrote:\n${q.text.split("\n").map((l) => `> ${l}`).join("\n")}` : "";
    const quoteHtml = q ? `<br><div>On ${esc(q.when)}, ${esc(q.from)} &lt;${esc(q.fromEmail)}&gt; wrote:</div><blockquote style="margin:0 0 0 .8ex;border-left:1px solid #ccc;padding-left:1ex">${textToHtml(q.text)}</blockquote>` : "";
    const fd = new FormData();
    fd.set("to", to); fd.set("cc", cc); fd.set("bcc", bcc); fd.set("subject", subject);
    fd.set("html", `<div>${body?.innerHTML ?? ""}</div>${quoteHtml}`); fd.set("text", (body?.innerText ?? "") + quoteText);
    if (init.threadId) fd.set("threadId", init.threadId);
    if (init.inReplyTo) fd.set("inReplyTo", init.inReplyTo);
    if (init.references) fd.set("references", init.references);
    if (draftId) fd.set("draftId", draftId);
    return fd;
  }, [to, cc, bcc, subject, quote, init, draftId]);

  // Autosave a draft a couple of seconds after typing stops.
  const scheduleSave = useCallback(() => {
    dirty.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (!dirty.current || countdown !== null || sending) return;
      setSaved("saving");
      const r = await saveMailDraft(build());
      if (r.ok) { setDraftId(r.draftId); setSaved("saved"); dirty.current = false; } else setSaved("idle");
    }, 2500);
  }, [build, countdown, sending]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  // Only save a draft once the person actually changes something (not just by opening a reply).
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    scheduleSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, cc, bcc, subject]);

  const addFiles = (list: FileList | null) => {
    Array.from(list ?? []).forEach((file) => {
      const id = Math.random();
      setFiles((f) => [...f, { id, file, ready: false }]);
      file.arrayBuffer().then(() => setFiles((f) => f.map((x) => (x.id === id ? { ...x, ready: true } : x))));
    });
  };

  // Undo send: wait a few seconds before actually sending.
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      if (sentOnce.current) return;
      sentOnce.current = true;
      (async () => {
        setSending(true);
        if (timer.current) clearTimeout(timer.current);
        const fd = build();
        files.forEach((f) => fd.append("files", f.file));
        if (init.forwardFrom) fd.set("forwardFrom", init.forwardFrom);
        const r = await sendMail(fd);
        setSending(false);
        setCountdown(null);
        if (!r.ok) { sentOnce.current = false; return setErr(r.error); }
        router.refresh();
        onSent(r.skipped ? `Sent ✓ (${r.skipped} attachment${r.skipped === 1 ? " was" : "s were"} too big to forward)` : "Sent from your Gmail ✓");
      })();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
  }, [countdown, build, files, init.forwardFrom, onSent, router]);

  const send = () => {
    setErr(null);
    if (!to.trim() && !cc.trim() && !bcc.trim()) return setErr("Add who it's going to.");
    if (!editor.current?.innerText.trim() && !subject.trim()) return setErr("Write something first.");
    if (tooBig) return setErr("Attachments are over 4 MB.");
    setCountdown(UNDO_SECONDS);
  };

  const discard = async () => {
    if (timer.current) clearTimeout(timer.current);
    if (draftId) await discardMailDraft(draftId);
    onClose();
    if (draftId) router.refresh();
  };

  const busy = countdown !== null || sending;
  const title = { new: "New email", reply: "Reply", all: "Reply all", forward: "Forward", draft: "Draft" }[init.mode];

  return (
    <section className={`card composer ${floating ? "composer-floating" : ""}`} aria-label={title}>
      <div className="row between" style={{ marginBottom: 10 }}>
        <strong>{title}</strong>
        <span className="tiny muted">{saved === "saving" ? "Saving draft…" : saved === "saved" ? "Draft saved" : ""}</span>
      </div>
      <div className="col" style={{ gap: 6, marginBottom: 8 }}>
        <label className="row small" style={{ gap: 8 }}>
          <span className="muted" style={{ width: 52 }}>To</span>
          <input className="input" style={{ height: 36 }} value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@email.com, …" disabled={busy} />
          {!showCc && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowCc(true)}>Cc/Bcc</button>}
        </label>
        {showCc && <>
          <label className="row small" style={{ gap: 8 }}><span className="muted" style={{ width: 52 }}>Cc</span><input className="input" style={{ height: 36 }} value={cc} onChange={(e) => setCc(e.target.value)} disabled={busy} /></label>
          <label className="row small" style={{ gap: 8 }}><span className="muted" style={{ width: 52 }}>Bcc</span><input className="input" style={{ height: 36 }} value={bcc} onChange={(e) => setBcc(e.target.value)} disabled={busy} /></label>
        </>}
        {showSubject && <label className="row small" style={{ gap: 8 }}><span className="muted" style={{ width: 52 }}>Subject</span><input className="input" style={{ height: 36 }} value={subject} onChange={(e) => setSubject(e.target.value)} disabled={busy} /></label>}
      </div>

      <div ref={editor} className="editor" contentEditable={!busy} suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label="Message" onInput={scheduleSave} />

      {(files.length > 0 || (init.forwardCount ?? 0) > 0) && (
        <div className="col" style={{ gap: 6, marginTop: 10 }}>
          {(init.forwardCount ?? 0) > 0 && <div className="attach-row"><span>📎 {init.forwardCount} attachment{init.forwardCount === 1 ? "" : "s"} from the original email</span><span className="small" style={{ color: "var(--success)" }}>✓ Included</span><span /></div>}
          {files.map((f) => (
            <div key={f.id} className="attach-row">
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📎 {f.file.name} <span className="faint">{kb(f.file.size)}</span></span>
              <span className="small" style={{ color: busy ? "var(--muted)" : f.ready ? "var(--success)" : "var(--muted)", whiteSpace: "nowrap" }}>{busy ? "Sending…" : f.ready ? "✓ Attached" : "Adding…"}</span>
              {!busy ? <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => setFiles((x) => x.filter((y) => y.id !== f.id))} aria-label={`Remove ${f.file.name}`}><I.x style={{ width: 14 }} /></button> : <span />}
            </div>
          ))}
          {files.length > 0 && <span className="tiny" style={{ color: tooBig ? "var(--danger)" : "var(--muted)" }}>{kb(total)} of 4 MB</span>}
        </div>
      )}
      {tooBig && <p className="small" style={{ marginTop: 8, color: "var(--danger)" }}>Too big for Space (4 MB max). Remove a file{gmailUrl ? <>, or <a href={gmailUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>send this from Gmail</a></> : null}.</p>}
      {err && <p className="small" style={{ marginTop: 8, color: "var(--danger)" }}>{err}</p>}

      <div className="editor-bar" role="toolbar" aria-label="Formatting">
        <button type="button" onMouseDown={keep} onClick={() => cmd("bold")} aria-label="Bold" title="Bold"><b>B</b></button>
        <button type="button" onMouseDown={keep} onClick={() => cmd("italic")} aria-label="Italic" title="Italic"><i>I</i></button>
        <button type="button" onMouseDown={keep} onClick={() => cmd("underline")} aria-label="Underline" title="Underline"><u>U</u></button>
        <span className="editor-sep" />
        <button type="button" onMouseDown={keep} onClick={() => cmd("insertUnorderedList")} aria-label="Bulleted list" title="Bulleted list">• ≡</button>
        <button type="button" onMouseDown={keep} onClick={() => cmd("insertOrderedList")} aria-label="Numbered list" title="Numbered list">1. ≡</button>
      </div>
      <div className="row between wrap" style={{ gap: 8, marginTop: 10 }}>
        {countdown !== null && !sending ? (
          <div className="row" style={{ gap: 10 }}>
            <span className="small">Sending in {countdown}s…</span>
            <button className="btn btn-sm" onClick={() => setCountdown(null)}>Undo</button>
          </div>
        ) : (
          <div className="row" style={{ gap: 4 }}>
            <button className="btn btn-accent" onClick={send} disabled={busy || tooBig || reading}>{sending ? "Sending…" : "Send"}</button>
            <button type="button" className="btn btn-ghost btn-icon" onClick={() => fileInput.current?.click()} disabled={busy} aria-label="Attach files" title="Attach files">📎</button>
            <button type="button" className="btn btn-ghost btn-icon" onMouseDown={keep} disabled={busy} aria-label="Insert link" title="Insert link"
              onClick={() => { const u = prompt("Link address (https://…)"); if (u && /^(https?:|mailto:)/i.test(u)) cmd("createLink", u); }}>🔗</button>
            <input ref={fileInput} type="file" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
            {init.quote && (
              <label className="row tiny muted" style={{ gap: 6, marginLeft: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={quote} onChange={(e) => setQuote(e.target.checked)} /> Include the previous email
              </label>
            )}
          </div>
        )}
        <button type="button" className="btn btn-ghost btn-icon" onClick={discard} disabled={busy} aria-label="Discard" title={draftId ? "Discard draft" : "Discard"}><I.trash style={{ width: 16 }} /></button>
      </div>
    </section>
  );
}
