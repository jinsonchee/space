"use server";
import { sql } from "@/lib/db";
import { requireMember } from "@/lib/auth";
import { applyThreadAction, deleteDraft, forwardFiles, inverseOf, saveDraft, sendEmail, MAX_ATTACH_BYTES, type OutgoingFile, type ThreadAction } from "@/lib/gmail";

const ACTIONS = /^(read|unread|archive|inbox|star|unstar|spam|notspam|trash|untrash|(un)?label:[\w-]+)$/;

/** Bulk action on selected conversations. Returns the action that undoes it. */
export async function threadAction(ids: string[], action: string) {
  const me = await requireMember();
  if (!ACTIONS.test(action) || !Array.isArray(ids)) return { ok: false as const, error: "Unknown action." };
  const r = await applyThreadAction(me.id, ids.map(String), action as ThreadAction);
  if (!r.ok) return { ok: false as const, error: r.failed === ids.length ? "Gmail didn't accept that. Please try again." : `Done, but ${r.failed} couldn't be changed.` };
  return { ok: true as const, undo: inverseOf(action as ThreadAction) };
}

function fields(fd: FormData) {
  const s = (k: string) => String(fd.get(k) ?? "");
  return {
    threadId: s("threadId") || undefined, to: s("to"), cc: s("cc"), bcc: s("bcc"), subject: s("subject"),
    html: s("html"), text: s("text"), inReplyTo: s("inReplyTo") || undefined, references: s("references") || undefined,
    draftId: s("draftId") || undefined,
  };
}

/** Send a new email, reply or forward. */
export async function sendMail(fd: FormData) {
  const me = await requireMember();
  const f = fields(fd);
  if (!f.text.trim() && !f.subject.trim()) return { ok: false as const, error: "Write something first." };
  const files: OutgoingFile[] = [];
  let total = 0;
  for (const file of fd.getAll("files")) {
    if (!(file instanceof File) || !file.size) continue;
    total += file.size;
    if (total > MAX_ATTACH_BYTES) return { ok: false as const, error: "Attachments are over 4 MB. Send this one from Gmail instead." };
    files.push({ name: file.name, type: file.type, data: Buffer.from(await file.arrayBuffer()) });
  }
  // Forwarding: bring the original email's attachments along (while they fit).
  const fwd = String(fd.get("forwardFrom") ?? "").split(":");
  let skipped = 0;
  if (fwd.length === 2 && fwd[0] && fwd[1]) {
    const r = await forwardFiles(me.id, fwd[0], fwd[1]);
    for (const x of r.files) {
      if (total + x.data.length > MAX_ATTACH_BYTES) { skipped++; continue; }
      total += x.data.length;
      files.push(x);
    }
    skipped += r.skipped;
  }
  const r = await sendEmail(me.id, { ...f, files });
  return r.ok ? { ...r, skipped } : r;
}

/** Autosave while writing. */
export async function saveMailDraft(fd: FormData) {
  const me = await requireMember();
  return saveDraft(me.id, fields(fd));
}

export async function discardMailDraft(draftId: string) {
  const me = await requireMember();
  await deleteDraft(me.id, String(draftId));
}

export async function saveSignature(text: string) {
  const me = await requireMember();
  await sql`update members set email_signature = ${String(text).slice(0, 1000)} where id = ${me.id}`;
  return { ok: true as const };
}
