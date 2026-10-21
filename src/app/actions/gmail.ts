"use server";
import { requireMember } from "@/lib/auth";
import { sendReply, MAX_ATTACH_BYTES, type OutgoingFile } from "@/lib/gmail";

export async function sendGmailReply(fd: FormData) {
  const me = await requireMember();
  const s = (k: string) => String(fd.get(k) ?? "");
  const threadId = s("threadId");
  if (!/^[0-9a-f]+$/i.test(threadId)) return { ok: false as const, error: "Missing conversation." };
  if (!s("to").trim()) return { ok: false as const, error: "Add who it's going to." };
  if (!s("text").trim()) return { ok: false as const, error: "Write something first." };
  const files: OutgoingFile[] = [];
  let total = 0;
  for (const f of fd.getAll("files")) {
    if (!(f instanceof File) || !f.size) continue;
    total += f.size;
    if (total > MAX_ATTACH_BYTES) return { ok: false as const, error: "Attachments are over 4 MB. Send this one from Gmail instead." };
    files.push({ name: f.name, type: f.type, data: Buffer.from(await f.arrayBuffer()) });
  }
  return sendReply(me.id, {
    threadId, to: s("to"), cc: s("cc"), subject: s("subject"), html: s("html"), text: s("text"),
    inReplyTo: s("inReplyTo"), references: s("references"), files,
  });
}
