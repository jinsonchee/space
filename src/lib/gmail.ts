import "server-only";
import { randomBytes } from "node:crypto";
import { accessToken, calendarConfigured, getConnection, markExpired } from "./google";

// Gmail (read + send), each person's own inbox. Emails are read live from Google and never
// stored in the database. Uses the person's encrypted Google connection from google.ts.

const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const TIMEOUT = 8000;
export const MAX_ATTACH_BYTES = 4 * 1024 * 1024; // Vercel caps uploads at ~4.5 MB

type Fail = { state: "off" | "expired" | "error" };
export type GmailResult<T> = Fail | ({ state: "ok" } & T);

type Header = { name: string; value: string };
type Part = { mimeType?: string; filename?: string; headers?: Header[]; body?: { data?: string; size?: number; attachmentId?: string }; parts?: Part[] };
type GMessage = { id: string; threadId: string; labelIds?: string[]; snippet?: string; internalDate?: string; payload?: Part };

async function gmail<T>(memberId: string, path: string, init?: RequestInit): Promise<{ ok: true; data: T } | Fail> {
  if (!calendarConfigured()) return { state: "off" };
  const conn = await getConnection(memberId);
  if (!conn || !conn.features.includes("gmail")) return { state: "off" };
  if (conn.status === "expired") return { state: "expired" };
  try {
    const call = (token: string) => fetch(`${API}${path}`, { ...init, headers: { ...init?.headers, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(TIMEOUT), cache: "no-store" });
    let token = await accessToken(memberId);
    if (!token) return { state: (await getConnection(memberId))?.status === "expired" ? "expired" : "error" };
    let res = await call(token);
    if (res.status === 401) {
      token = await accessToken(memberId, true);
      if (!token) return { state: "expired" };
      res = await call(token);
    }
    if (res.status === 401) { await markExpired(memberId); return { state: "expired" }; }
    if (!res.ok) { console.error(`[gmail] ${init?.method ?? "GET"} ${path.split("?")[0]} → ${res.status}`); return { state: "error" }; }
    return { ok: true, data: (await res.json()) as T };
  } catch (e) {
    console.error(`[gmail] ${path.split("?")[0]} failed: ${(e as Error).name}`);
    return { state: "error" };
  }
}

const header = (p: Part | undefined, name: string) => p?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
const decode = (data?: string) => (data ? Buffer.from(data, "base64url").toString("utf8") : "");

/** "Name <a@b.com>" → { name, email } */
export function parseAddress(v: string) {
  const m = v.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  return m ? { name: m[1].trim() || m[2], email: m[2].trim() } : { name: v.trim(), email: v.trim() };
}

export type ThreadSummary = { id: string; from: string; subject: string; snippet: string; date: number; unread: boolean; count: number };

/** Recent Primary-inbox conversations. */
export async function listInbox(memberId: string, opts: { unreadOnly?: boolean; max?: number } = {}): Promise<GmailResult<{ threads: ThreadSummary[]; estimate: number }>> {
  const q = `in:inbox category:primary${opts.unreadOnly ? " is:unread" : ""}`;
  const list = await gmail<{ threads?: { id: string }[]; resultSizeEstimate?: number }>(memberId, `/threads?${new URLSearchParams({ q, maxResults: String(opts.max ?? 25) })}`);
  if (!("ok" in list)) return list;
  const ids = list.data.threads?.map((t) => t.id) ?? [];
  const meta = new URLSearchParams({ format: "metadata" });
  ["From", "Subject", "Date"].forEach((h) => meta.append("metadataHeaders", h));
  const threads = await Promise.all(ids.map(async (id) => {
    const t = await gmail<{ messages?: GMessage[] }>(memberId, `/threads/${id}?${meta}`);
    if (!("ok" in t) || !t.data.messages?.length) return null;
    const msgs = t.data.messages;
    const last = msgs[msgs.length - 1];
    return {
      id,
      from: parseAddress(header(last.payload, "From")).name,
      subject: header(msgs[0].payload, "Subject") || "(no subject)",
      snippet: decodeEntities(last.snippet ?? ""),
      date: Number(last.internalDate ?? 0),
      unread: msgs.some((m) => m.labelIds?.includes("UNREAD")),
      count: msgs.length,
    } satisfies ThreadSummary;
  }));
  return { state: "ok", threads: threads.filter((t): t is ThreadSummary => t !== null), estimate: list.data.resultSizeEstimate ?? ids.length };
}

export type Attachment = { messageId: string; attachmentId: string; filename: string; mimeType: string; size: number };
export type Message = {
  id: string; from: string; fromEmail: string; to: string; cc: string; replyTo: string; date: number; subject: string;
  messageIdHeader: string; references: string; html: string | null; text: string; attachments: Attachment[];
};

function walk(p: Part, m: GMessage, out: { html: string | null; text: string; attachments: Attachment[] }) {
  if (p.filename && p.body?.attachmentId) {
    out.attachments.push({ messageId: m.id, attachmentId: p.body.attachmentId, filename: p.filename, mimeType: p.mimeType ?? "application/octet-stream", size: p.body.size ?? 0 });
  } else if (p.mimeType === "text/html" && out.html === null) out.html = decode(p.body?.data);
  else if (p.mimeType === "text/plain" && !out.text) out.text = decode(p.body?.data);
  p.parts?.forEach((c) => walk(c, m, out));
}

/** A whole conversation, oldest first, with bodies and attachment info. */
export async function getThread(memberId: string, threadId: string): Promise<GmailResult<{ subject: string; messages: Message[]; account: string | null }>> {
  if (!/^[0-9a-f]+$/i.test(threadId)) return { state: "error" };
  const t = await gmail<{ messages?: GMessage[] }>(memberId, `/threads/${threadId}?format=full`);
  if (!("ok" in t)) return t;
  const messages = (t.data.messages ?? []).map((m): Message => {
    const out = { html: null as string | null, text: "", attachments: [] as Attachment[] };
    if (m.payload) walk(m.payload, m, out);
    if (!out.text && out.html) out.text = htmlToText(out.html);
    const from = parseAddress(header(m.payload, "From"));
    return {
      id: m.id, from: from.name, fromEmail: from.email, to: header(m.payload, "To"), cc: header(m.payload, "Cc"), replyTo: header(m.payload, "Reply-To"),
      date: Number(m.internalDate ?? 0), subject: header(m.payload, "Subject"), messageIdHeader: header(m.payload, "Message-ID"),
      references: header(m.payload, "References"), html: out.html, text: out.text, attachments: out.attachments,
    };
  });
  const account = (await getConnection(memberId))?.google_email ?? null;
  return { state: "ok", subject: messages[0]?.subject || "(no subject)", messages, account };
}

export async function getAttachment(memberId: string, messageId: string, attachmentId: string) {
  if (!/^[0-9a-f]+$/i.test(messageId) || !/^[\w-]+$/.test(attachmentId)) return null;
  const r = await gmail<{ data?: string }>(memberId, `/messages/${messageId}/attachments/${attachmentId}`);
  return "ok" in r && r.data.data ? Buffer.from(r.data.data, "base64url") : null;
}

// ---------- sending ----------

const encodeHeader = (v: string) => (/^[\x20-\x7e]*$/.test(v) ? v : `=?UTF-8?B?${Buffer.from(v).toString("base64")}?=`);
const wrap76 = (b64: string) => b64.replace(/.{1,76}/g, "$&\r\n");
const clean = (v: string) => v.replace(/[\r\n]+/g, " ").trim(); // no header injection

export type OutgoingFile = { name: string; type: string; data: Buffer };

/** Sends an HTML email (with plain-text fallback and attachments) from the person's own Gmail, in the same thread. */
export async function sendReply(memberId: string, r: { threadId: string; to: string; cc: string; subject: string; html: string; text: string; inReplyTo: string; references: string; files: OutgoingFile[] }) {
  const total = r.files.reduce((n, f) => n + f.data.length, 0);
  if (total > MAX_ATTACH_BYTES) return { ok: false as const, error: "Attachments are over 4 MB. Send this one from Gmail instead." };
  const mixed = `mixed_${randomBytes(12).toString("hex")}`;
  const alt = `alt_${randomBytes(12).toString("hex")}`;
  const lines = [
    `To: ${clean(r.to)}`,
    ...(clean(r.cc) ? [`Cc: ${clean(r.cc)}`] : []),
    `Subject: ${encodeHeader(clean(r.subject))}`,
    ...(r.inReplyTo ? [`In-Reply-To: ${clean(r.inReplyTo)}`, `References: ${clean(`${r.references} ${r.inReplyTo}`)}`] : []),
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${mixed}"`,
    "",
    `--${mixed}`,
    `Content-Type: multipart/alternative; boundary="${alt}"`,
    "",
    `--${alt}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(Buffer.from(r.text).toString("base64")),
    `--${alt}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(Buffer.from(r.html).toString("base64")),
    `--${alt}--`,
    ...r.files.flatMap((f) => [
      `--${mixed}`,
      `Content-Type: ${clean(f.type) || "application/octet-stream"}; name="${encodeHeader(clean(f.name).replace(/"/g, ""))}"`,
      `Content-Disposition: attachment; filename="${encodeHeader(clean(f.name).replace(/"/g, ""))}"`,
      "Content-Transfer-Encoding: base64",
      "",
      wrap76(f.data.toString("base64")),
    ]),
    `--${mixed}--`,
    "",
  ];
  const raw = Buffer.from(lines.join("\r\n")).toString("base64url");
  const res = await gmail<{ id: string }>(memberId, "/messages/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ raw, threadId: r.threadId }),
  });
  if ("ok" in res) return { ok: true as const };
  return { ok: false as const, error: res.state === "expired" ? "Your Google connection expired. Reconnect it in My profile." : "Gmail didn't accept that. Please try again." };
}

/** Rough plain-text version of an HTML email (for previews and quoting in replies). */
function htmlToText(html: string) {
  return decodeEntities(
    html
      .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n"),
  ).trim();
}

function decodeEntities(s: string) {
  return s.replace(/&(#\d+|#x[0-9a-f]+|amp|lt|gt|quot|#39|apos);/gi, (m, e: string) => {
    const k = e.toLowerCase();
    if (k[0] === "#") return String.fromCodePoint(k[1] === "x" ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10));
    return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" } as Record<string, string>)[k] ?? m;
  });
}

/** Link that opens this conversation in Gmail, in the right Google account. */
export const gmailLink = (threadId: string, account: string | null) =>
  `https://mail.google.com/mail/${account ? `?authuser=${encodeURIComponent(account)}` : "u/0/"}#all/${threadId}`;
