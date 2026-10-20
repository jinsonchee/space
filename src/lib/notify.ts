import "server-only";
import { sql, getSettings } from "./db";

type Note = {
  memberId: string;
  kind: string;
  title: string;
  body?: string;
  link?: string;
  dedupeKey?: string;
  email?: boolean; // also send by email when email is configured
};

/** Creates an in-app notification (delivered by the pet) and optionally emails it. */
export async function notify(n: Note) {
  const rows = await sql`
    insert into notifications (member_id, kind, title, body, link, dedupe_key)
    values (${n.memberId}, ${n.kind}, ${n.title}, ${n.body ?? ""}, ${n.link ?? null}, ${n.dedupeKey ?? null})
    on conflict (member_id, dedupe_key) do nothing
    returning id`;
  if (rows.length === 0) return false; // already sent
  if (n.email) await sendEmail(n.memberId, n.title, n.body ?? "", n.link).catch(() => {});
  return true;
}

export function emailEnabled() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

async function sendEmail(memberId: string, subject: string, body: string, link?: string) {
  if (!emailEnabled()) return;
  const [m] = await sql<{ email: string | null; name: string }[]>`select email, name from members where id = ${memberId}`;
  if (!m?.email) return;
  const s = await getSettings();
  const space = s ? `${s.artist_name}'s Space` : "Space";
  const appUrl = process.env.APP_URL?.replace(/\/$/, "");
  const href = appUrl && link ? `${appUrl}${link}` : appUrl;
  const accent = s?.accent ?? "#1ed760";
  const html = `
  <div style="font-family:Inter,Arial,sans-serif;background:#0f0f12;padding:32px;color:#f4f4f5">
    <div style="max-width:480px;margin:0 auto;background:#18181c;border-radius:20px;padding:28px">
      <div style="font-size:13px;color:#a1a1aa;margin-bottom:12px">${escapeHtml(space)}</div>
      <div style="font-size:22px;font-weight:700;letter-spacing:-0.5px;margin-bottom:10px">${escapeHtml(subject)}</div>
      <div style="font-size:15px;line-height:1.5;color:#d4d4d8;white-space:pre-line">${escapeHtml(body)}</div>
      ${href ? `<a href="${href}" style="display:inline-block;margin-top:20px;background:${accent};color:#0b0b0d;padding:12px 18px;border-radius:999px;font-weight:700;text-decoration:none">Open ${escapeHtml(space)}</a>` : ""}
    </div>
  </div>`;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: m.email, subject: `${subject} · ${space}`, html }),
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
