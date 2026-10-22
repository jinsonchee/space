import "server-only";
import { randomBytes } from "node:crypto";
import { accessToken, calendarConfigured, connectionOnce, getConnection, markExpired, tokenOnce } from "./google";

// Gmail for each person's own mailbox: folders, search, read, bulk actions (read/unread, archive,
// trash, star, labels, spam), compose, reply, forward and drafts. Emails are read live from Google
// and never stored in the database. Space only changes email when the person clicks a button;
// it never permanently deletes (Trash empties itself after 30 days, as in Gmail).

const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const TIMEOUT = 8000;
export const MAX_ATTACH_BYTES = 4 * 1024 * 1024; // Vercel caps uploads at ~4.5 MB

type Fail = { state: "off" | "expired" | "error" };
export type GmailResult<T> = Fail | ({ state: "ok" } & T);

type Header = { name: string; value: string };
type Part = { mimeType?: string; filename?: string; headers?: Header[]; body?: { data?: string; size?: number; attachmentId?: string }; parts?: Part[] };
type GMessage = { id: string; threadId: string; labelIds?: string[]; snippet?: string; internalDate?: string; payload?: Part };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Runs fn over items with at most `limit` running at once (Gmail allows ~250 quota units per
 *  person per second; reading one conversation costs 10, so 30 at once is over the limit). */
async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i]); }
  }));
  return out;
}

const safePath = (path: string) => path.split("?")[0].replace(/\/[0-9a-z_-]{10,}/gi, "/:id");

async function gmail<T>(memberId: string, path: string, init?: RequestInit): Promise<{ ok: true; data: T } | Fail> {
  if (!calendarConfigured()) return { state: "off" };
  const conn = await connectionOnce(memberId);
  if (!conn || !conn.features.includes("gmail")) return { state: "off" };
  if (conn.status === "expired") return { state: "expired" };
  try {
    const call = (token: string) => fetch(`${API}${path}`, { ...init, headers: { ...init?.headers, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(TIMEOUT), cache: "no-store" });
    let token = await tokenOnce(memberId);
    if (!token) return { state: (await getConnection(memberId))?.status === "expired" ? "expired" : "error" };
    let res = await call(token);
    // Gmail says "slow down" with 429, or 403 + a rate-limit reason: wait a moment and retry once.
    if (res.status === 429 || (res.status === 403 && /rateLimit/i.test(await res.clone().text()))) {
      await sleep(1200);
      res = await call(token);
    }
    if (res.status === 401) {
      token = await accessToken(memberId, true);
      if (!token) return { state: "expired" };
      res = await call(token);
    }
    if (res.status === 401) { await markExpired(memberId); return { state: "expired" }; }
    if (!res.ok) {
      // Google's reason code only (e.g. insufficientPermissions, accessNotConfigured) — never content.
      const why = await res.json().then((b: { error?: { status?: string; errors?: { reason?: string }[] } }) => b.error?.errors?.[0]?.reason ?? b.error?.status ?? "").catch(() => "");
      console.error(`[gmail] ${init?.method ?? "GET"} ${safePath(path)} → ${res.status} ${why}`);
      return { state: "error" };
    }
    const body = await res.text();
    return { ok: true, data: (body ? JSON.parse(body) : {}) as T };
  } catch (e) {
    console.error(`[gmail] ${safePath(path)} failed: ${(e as Error).name}`);
    return { state: "error" };
  }
}

const header = (p: Part | undefined, name: string) => p?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
const decode = (data?: string) => (data ? Buffer.from(data, "base64url").toString("utf8") : "");
const isId = (v: string) => /^[0-9a-f]{6,}$/i.test(v);

/** "Name <a@b.com>" → { name, email } */
export function parseAddress(v: string) {
  const m = v.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  return m ? { name: m[1].trim() || m[2], email: m[2].trim() } : { name: v.trim(), email: v.trim() };
}

// ---------- folders & listing ----------

export const FOLDERS = [
  { key: "inbox", name: "Inbox", label: "INBOX" },
  { key: "starred", name: "Starred", label: "STARRED" },
  { key: "sent", name: "Sent", label: "SENT" },
  { key: "drafts", name: "Drafts", label: "DRAFT" },
  { key: "all", name: "All mail", label: null },
  { key: "spam", name: "Spam", label: "SPAM" },
  { key: "trash", name: "Trash", label: "TRASH" },
] as const;
export type FolderKey = (typeof FOLDERS)[number]["key"];
export const TABS = [
  { key: "primary", name: "Primary" },
  { key: "promotions", name: "Promotions" },
  { key: "social", name: "Social" },
  { key: "updates", name: "Updates" },
] as const;
export type TabKey = (typeof TABS)[number]["key"];

export type ThreadSummary = { id: string; from: string; to: string; subject: string; snippet: string; date: number; unread: boolean; starred: boolean; count: number; labels: string[] };
export type ListOpts = { folder?: FolderKey; tab?: TabKey; label?: string; q?: string; pageToken?: string; max?: number; unreadOnly?: boolean };

/** Conversations in a folder / tab / label, or matching a Gmail search. */
export async function listThreads(memberId: string, o: ListOpts = {}): Promise<GmailResult<{ threads: ThreadSummary[]; estimate: number; nextPageToken: string | null }>> {
  const p = new URLSearchParams({ maxResults: String(o.max ?? 25) });
  const terms: string[] = [];
  if (o.q?.trim()) {
    terms.push(o.q.trim().slice(0, 300)); // a search looks through all mail, like Gmail
  } else if (o.label && /^[\w-]+$/.test(o.label)) {
    p.append("labelIds", o.label);
  } else {
    const f = FOLDERS.find((x) => x.key === (o.folder ?? "inbox")) ?? FOLDERS[0];
    if (f.label) p.append("labelIds", f.label);
    if (f.key === "inbox") terms.push(`category:${o.tab ?? "primary"}`);
    if (f.key === "spam" || f.key === "trash") p.set("includeSpamTrash", "true");
  }
  if (o.unreadOnly) terms.push("is:unread");
  if (terms.length) p.set("q", terms.join(" "));
  if (o.pageToken && /^[\w-]+$/.test(o.pageToken)) p.set("pageToken", o.pageToken);
  const list = await gmail<{ threads?: { id: string }[]; resultSizeEstimate?: number; nextPageToken?: string }>(memberId, `/threads?${p}`);
  if (!("ok" in list)) return list;
  const ids = list.data.threads?.map((t) => t.id) ?? [];
  const meta = new URLSearchParams({ format: "metadata" });
  ["From", "To", "Subject", "Date"].forEach((h) => meta.append("metadataHeaders", h));
  const threads = await mapLimit(ids, 10, async (id) => { // 10 at once: ~2–3 rounds for a page of 25 (a 429 is retried)
    const t = await gmail<{ messages?: GMessage[] }>(memberId, `/threads/${id}?${meta}`);
    if (!("ok" in t) || !t.data.messages?.length) return null;
    const msgs = t.data.messages;
    const last = msgs[msgs.length - 1];
    const labels = [...new Set(msgs.flatMap((m) => m.labelIds ?? []))];
    return {
      id,
      from: parseAddress(header(last.payload, "From")).name,
      to: header(last.payload, "To").split(",").map((a) => parseAddress(a).name).filter(Boolean).join(", "),
      subject: header(msgs[0].payload, "Subject") || "(no subject)",
      snippet: decodeEntities(last.snippet ?? ""),
      date: Number(last.internalDate ?? 0),
      unread: msgs.some((m) => m.labelIds?.includes("UNREAD")),
      starred: labels.includes("STARRED"),
      count: msgs.length,
      labels,
    } satisfies ThreadSummary;
  });
  return {
    state: "ok",
    threads: threads.filter((t): t is ThreadSummary => t !== null),
    estimate: list.data.resultSizeEstimate ?? ids.length,
    nextPageToken: list.data.nextPageToken ?? null,
  };
}

/** Home card: latest unread in the Primary tab. */
export function listInbox(memberId: string, opts: { unreadOnly?: boolean; max?: number } = {}) {
  return listThreads(memberId, { folder: "inbox", tab: "primary", unreadOnly: opts.unreadOnly, max: opts.max ?? 25 });
}

export type GLabel = { id: string; name: string };

/** The person's own Gmail labels, plus the Inbox unread count. */
export async function getLabels(memberId: string): Promise<{ labels: GLabel[]; inboxUnread: number }> {
  const [all, inbox] = await Promise.all([
    gmail<{ labels?: { id: string; name: string; type: string }[] }>(memberId, "/labels"),
    gmail<{ threadsUnread?: number }>(memberId, "/labels/INBOX"),
  ]);
  const labels = "ok" in all ? (all.data.labels ?? []).filter((l) => l.type === "user").map((l) => ({ id: l.id, name: l.name })).sort((a, b) => a.name.localeCompare(b.name)) : [];
  return { labels, inboxUnread: "ok" in inbox ? inbox.data.threadsUnread ?? 0 : 0 };
}

// ---------- actions on conversations ----------

export type ThreadAction = "read" | "unread" | "archive" | "inbox" | "star" | "unstar" | "spam" | "notspam" | "trash" | "untrash" | `label:${string}` | `unlabel:${string}`;

/** What reverses an action (for Undo). */
export function inverseOf(a: ThreadAction): ThreadAction {
  const map: Record<string, ThreadAction> = { read: "unread", unread: "read", archive: "inbox", inbox: "archive", star: "unstar", unstar: "star", spam: "notspam", notspam: "spam", trash: "untrash", untrash: "trash" };
  if (a.startsWith("label:")) return `unlabel:${a.slice(6)}`;
  if (a.startsWith("unlabel:")) return `label:${a.slice(8)}`;
  return map[a];
}

function changesFor(a: ThreadAction): { add: string[]; remove: string[] } | "trash" | "untrash" {
  switch (a) {
    case "read": return { add: [], remove: ["UNREAD"] };
    case "unread": return { add: ["UNREAD"], remove: [] };
    case "archive": return { add: [], remove: ["INBOX"] };
    case "inbox": return { add: ["INBOX"], remove: [] };
    case "star": return { add: ["STARRED"], remove: [] };
    case "unstar": return { add: [], remove: ["STARRED"] };
    case "spam": return { add: ["SPAM"], remove: ["INBOX"] };
    case "notspam": return { add: ["INBOX"], remove: ["SPAM"] };
    case "trash": return "trash";
    case "untrash": return "untrash";
    default:
      // "Move to label" = add the label and take it out of the Inbox (like Gmail's Move to).
      if (a.startsWith("label:")) return { add: [a.slice(6)], remove: ["INBOX"] };
      return { add: ["INBOX"], remove: [a.slice(8)] };
  }
}

/** Applies one action to several conversations (a few at a time). */
export async function applyThreadAction(memberId: string, ids: string[], action: ThreadAction) {
  const change = changesFor(action);
  const good = ids.filter(isId).slice(0, 100);
  if (typeof change === "object" && [...change.add, ...change.remove].some((l) => !/^[\w-]+$/.test(l))) return { ok: false as const, failed: good.length };
  let failed = 0;
  for (let i = 0; i < good.length; i += 5) {
    const results = await Promise.all(good.slice(i, i + 5).map((id) =>
      change === "trash" || change === "untrash"
        ? gmail(memberId, `/threads/${id}/${change}`, { method: "POST" })
        : gmail(memberId, `/threads/${id}/modify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ addLabelIds: change.add, removeLabelIds: change.remove }) }),
    ));
    failed += results.filter((r) => !("ok" in r)).length;
  }
  return { ok: failed === 0, failed };
}

/** Marks a conversation as read in Gmail (only if the person granted the "mark as read" permission). */
export async function markThreadRead(memberId: string, threadId: string) {
  if (!isId(threadId) || !(await getConnection(memberId))?.canMarkRead) return;
  await applyThreadAction(memberId, [threadId], "read");
}

// ---------- reading a conversation ----------

export type Attachment = { messageId: string; attachmentId: string; filename: string; mimeType: string; size: number };
export type Message = {
  unread: boolean;
  draftId: string | null; // set when this message is an unsent draft
  id: string; from: string; fromEmail: string; to: string; cc: string; bcc: string; replyTo: string; date: number; subject: string;
  messageIdHeader: string; references: string; html: string | null; text: string; attachments: Attachment[];
};

function walk(p: Part, m: GMessage, out: { html: string | null; text: string; attachments: Attachment[] }) {
  if (p.filename && p.body?.attachmentId) {
    out.attachments.push({ messageId: m.id, attachmentId: p.body.attachmentId, filename: p.filename, mimeType: p.mimeType ?? "application/octet-stream", size: p.body.size ?? 0 });
  } else if (p.mimeType === "text/html" && out.html === null) out.html = decode(p.body?.data);
  else if (p.mimeType === "text/plain" && !out.text) out.text = decode(p.body?.data);
  p.parts?.forEach((c) => walk(c, m, out));
}

/** A whole conversation, oldest first, with bodies, attachment info and labels. */
export async function getThread(memberId: string, threadId: string): Promise<GmailResult<{ subject: string; messages: Message[]; account: string | null; labels: string[] }>> {
  if (!isId(threadId)) return { state: "error" };
  const t = await gmail<{ messages?: GMessage[] }>(memberId, `/threads/${threadId}?format=full`);
  if (!("ok" in t)) return t;
  const raw = t.data.messages ?? [];
  // Drafts need their draft id so they can be edited, sent or discarded.
  const draftIds = new Map<string, string>();
  if (raw.some((m) => m.labelIds?.includes("DRAFT"))) {
    const d = await gmail<{ drafts?: { id: string; message: { id: string } }[] }>(memberId, "/drafts?maxResults=200");
    if ("ok" in d) d.data.drafts?.forEach((x) => draftIds.set(x.message.id, x.id));
  }
  const messages = raw.map((m): Message => {
    const out = { html: null as string | null, text: "", attachments: [] as Attachment[] };
    if (m.payload) walk(m.payload, m, out);
    if (!out.text && out.html) out.text = htmlToText(out.html);
    const from = parseAddress(header(m.payload, "From"));
    return {
      unread: Boolean(m.labelIds?.includes("UNREAD")),
      draftId: m.labelIds?.includes("DRAFT") ? draftIds.get(m.id) ?? null : null,
      id: m.id, from: from.name, fromEmail: from.email, to: header(m.payload, "To"), cc: header(m.payload, "Cc"), bcc: header(m.payload, "Bcc"),
      replyTo: header(m.payload, "Reply-To"), date: Number(m.internalDate ?? 0), subject: header(m.payload, "Subject"),
      messageIdHeader: header(m.payload, "Message-ID"), references: header(m.payload, "References"), html: out.html, text: out.text, attachments: out.attachments,
    };
  });
  const account = (await getConnection(memberId))?.google_email ?? null;
  const labels = [...new Set(raw.flatMap((m) => m.labelIds ?? []))];
  return { state: "ok", subject: messages.find((m) => m.subject)?.subject || "(no subject)", messages, account, labels };
}

export async function getAttachment(memberId: string, messageId: string, attachmentId: string) {
  if (!isId(messageId) || !/^[\w-]+$/.test(attachmentId)) return null;
  const r = await gmail<{ data?: string }>(memberId, `/messages/${messageId}/attachments/${attachmentId}`);
  return "ok" in r && r.data.data ? Buffer.from(r.data.data, "base64url") : null;
}

// ---------- writing: send, drafts ----------

const encodeHeader = (v: string) => (/^[\x20-\x7e]*$/.test(v) ? v : `=?UTF-8?B?${Buffer.from(v).toString("base64")}?=`);
const wrap76 = (b64: string) => b64.replace(/.{1,76}/g, "$&\r\n");
const clean = (v: string) => v.replace(/[\r\n]+/g, " ").trim(); // no header injection

export type OutgoingFile = { name: string; type: string; data: Buffer };
export type Outgoing = {
  threadId?: string; to: string; cc: string; bcc: string; subject: string; html: string; text: string;
  inReplyTo?: string; references?: string; files: OutgoingFile[];
};

function buildRaw(r: Outgoing) {
  const mixed = `mixed_${randomBytes(12).toString("hex")}`;
  const alt = `alt_${randomBytes(12).toString("hex")}`;
  const lines = [
    ...(clean(r.to) ? [`To: ${clean(r.to)}`] : []),
    ...(clean(r.cc) ? [`Cc: ${clean(r.cc)}`] : []),
    ...(clean(r.bcc) ? [`Bcc: ${clean(r.bcc)}`] : []),
    `Subject: ${encodeHeader(clean(r.subject))}`,
    ...(r.inReplyTo ? [`In-Reply-To: ${clean(r.inReplyTo)}`, `References: ${clean(`${r.references ?? ""} ${r.inReplyTo}`)}`] : []),
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
  return Buffer.from(lines.join("\r\n")).toString("base64url");
}

const failMsg = (s: string) => (s === "expired" ? "Your Google connection expired. Reconnect it in My profile." : "Gmail didn't accept that. Please try again.");

/** Sends from the person's own Gmail (new email, reply or forward). Deletes the draft it came from, if any. */
export async function sendEmail(memberId: string, r: Outgoing & { draftId?: string }) {
  if (r.files.reduce((n, f) => n + f.data.length, 0) > MAX_ATTACH_BYTES) return { ok: false as const, error: "Attachments are over 4 MB. Send this one from Gmail instead." };
  if (!clean(r.to) && !clean(r.cc) && !clean(r.bcc)) return { ok: false as const, error: "Add who it's going to." };
  const res = await gmail<{ id: string; threadId: string }>(memberId, "/messages/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ raw: buildRaw(r), ...(r.threadId && isId(r.threadId) ? { threadId: r.threadId } : {}) }),
  });
  if (!("ok" in res)) return { ok: false as const, error: failMsg(res.state) };
  if (r.draftId && /^[\w-]+$/.test(r.draftId)) await gmail(memberId, `/drafts/${r.draftId}`, { method: "DELETE" });
  return { ok: true as const, threadId: res.data.threadId };
}

/** Creates or updates a draft (text and recipients; attachments are added when sending). */
export async function saveDraft(memberId: string, r: Omit<Outgoing, "files"> & { draftId?: string }) {
  const message = { raw: buildRaw({ ...r, files: [] }), ...(r.threadId && isId(r.threadId) ? { threadId: r.threadId } : {}) };
  const existing = r.draftId && /^[\w-]+$/.test(r.draftId) ? r.draftId : null;
  const res = await gmail<{ id: string }>(memberId, existing ? `/drafts/${existing}` : "/drafts", {
    method: existing ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(existing ? { id: existing, message } : { message }),
  });
  return "ok" in res ? { ok: true as const, draftId: res.data.id } : { ok: false as const, error: failMsg(res.state) };
}

export async function deleteDraft(memberId: string, draftId: string) {
  if (!/^[\w-]+$/.test(draftId)) return;
  await gmail(memberId, `/drafts/${draftId}`, { method: "DELETE" });
}

/** Original attachments for a forward (only while they fit under the size limit). */
export async function forwardFiles(memberId: string, threadId: string, messageId: string) {
  const t = await getThread(memberId, threadId);
  if (t.state !== "ok") return { files: [] as OutgoingFile[], skipped: 0 };
  const m = t.messages.find((x) => x.id === messageId);
  const files: OutgoingFile[] = [];
  let total = 0, skipped = 0;
  for (const a of m?.attachments ?? []) {
    if (total + a.size > MAX_ATTACH_BYTES) { skipped++; continue; }
    const data = await getAttachment(memberId, a.messageId, a.attachmentId);
    if (!data) { skipped++; continue; }
    total += data.length;
    files.push({ name: a.filename, type: a.mimeType, data });
  }
  return { files, skipped };
}

// ---------- text helpers ----------

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
  return s.replace(/&(#\d+|#x[0-9a-f]+|amp|lt|gt|quot|#39|apos|nbsp);/gi, (m, e: string) => {
    const k = e.toLowerCase();
    if (k[0] === "#") return String.fromCodePoint(k[1] === "x" ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10));
    return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " } as Record<string, string>)[k] ?? m;
  });
}

/** Link that opens this conversation in Gmail, in the right Google account. */
export const gmailLink = (threadId: string, account: string | null) =>
  `https://mail.google.com/mail/${account ? `?authuser=${encodeURIComponent(account)}` : "u/0/"}#all/${threadId}`;
