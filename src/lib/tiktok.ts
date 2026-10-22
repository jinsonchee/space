import "server-only";
import { sql, getSettings } from "./db";
import { encrypt, decrypt } from "./crypto";
import { todayIn } from "./dates";
import { notify } from "./notify";

// TikTok stats through the publisher's TikTok app (TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET) in
// Sandbox mode: the artist's TikTok is a "target user" on that app (max 10 per app). Tokens are
// encrypted and stored only in the artist's own database. Access tokens last 24h, refresh tokens
// a year; every sync renews them.

const API = "https://open.tiktokapis.com/v2";
export const TT_SCOPES = "user.info.basic,user.info.profile,user.info.stats,video.list";

export type TtAccount = { open_id: string; username: string; token: string; refresh: string; expires_at: string; refresh_expires_at: string; status: "ok" | "expired"; followers: number | null; likes: number | null; video_count: number | null; synced_at: string | null; connected_at: string };

export const tiktokConfigured = () => Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET && process.env.APP_URL);
export const ttRedirectUri = () => `${process.env.APP_URL!.replace(/\/$/, "")}/api/tiktok/callback`;
export const ttAuthUrl = (state: string) =>
  `https://www.tiktok.com/v2/auth/authorize/?${new URLSearchParams({ client_key: process.env.TIKTOK_CLIENT_KEY!, response_type: "code", scope: TT_SCOPES, redirect_uri: ttRedirectUri(), state })}`;

export async function getTikTok(): Promise<TtAccount | null> {
  const [r] = await sql<{ tiktok: TtAccount | null }[]>`select tiktok from settings where id = 1`;
  return r?.tiktok ?? null;
}
const saveAccount = (a: TtAccount | null) => sql`update settings set tiktok = ${a ? sql.json(a as never) : null} where id = 1`;

type Tokens = { access_token?: string; refresh_token?: string; expires_in?: number; refresh_expires_in?: number; open_id?: string; scope?: string; error?: string };
async function tokenRequest(body: Record<string, string>) {
  const res = await fetch(`${API}/oauth/token/`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_key: process.env.TIKTOK_CLIENT_KEY!, client_secret: process.env.TIKTOK_CLIENT_SECRET!, ...body }),
    signal: AbortSignal.timeout(10000),
  });
  const t = (await res.json().catch(() => ({}))) as Tokens;
  if (!t.access_token) console.error(`[tiktok] token ${body.grant_type} failed: ${t.error ?? res.status}`);
  return t;
}
const expiry = (secs: number | undefined, fallback: number) => new Date(Date.now() + (secs ?? fallback) * 1000).toISOString();

async function api<T>(path: string, token: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, { ...init, headers: { ...init?.headers, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000), cache: "no-store" });
  const body = (await res.json().catch(() => ({}))) as { data?: T; error?: { code?: string } };
  const ok = res.ok && (body.error?.code ?? "ok") === "ok";
  if (!ok) console.error(`[tiktok] ${path.split("?")[0]} → ${res.status} ${body.error?.code ?? ""}`);
  return { ok, data: body.data, code: body.error?.code };
}

/** Finishes "Connect TikTok": code → tokens (saved encrypted) → first sync. */
export async function connectTikTok(code: string) {
  const t = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: ttRedirectUri() });
  if (!t.access_token || !t.refresh_token) return { ok: false as const };
  const u = await api<{ user?: { username?: string } }>("/user/info/?fields=open_id,username", t.access_token);
  await saveAccount({
    open_id: t.open_id ?? "", username: u.data?.user?.username ?? "", token: encrypt(t.access_token), refresh: encrypt(t.refresh_token),
    expires_at: expiry(t.expires_in, 86_400), refresh_expires_at: expiry(t.refresh_expires_in, 31_536_000), status: "ok",
    followers: null, likes: null, video_count: null, synced_at: null, connected_at: new Date().toISOString(),
  });
  await syncTikTok();
  return { ok: true as const };
}

async function markExpired(a: TtAccount) {
  if (a.status === "expired") return;
  await saveAccount({ ...a, status: "expired" });
  const [artist] = await sql<{ id: string }[]>`select id from members where access = 'master' order by created_at limit 1`;
  if (artist) await notify({ memberId: artist.id, kind: "tiktok", title: "Reconnect TikTok 🎵", body: "TikTok stopped sharing your stats with Space. Reconnect it in Settings (10 seconds).", link: "/settings#tiktok", dedupeKey: `tiktok-expired:${a.connected_at}` });
}

type Video = { id: string; duration?: number; title?: string; video_description?: string; create_time?: number; cover_image_url?: string; share_url?: string; view_count?: number; like_count?: number; comment_count?: number; share_count?: number };

/** Daily: renew tokens, save followers for Home, and every recent video's numbers. */
export async function syncTikTok() {
  if (!tiktokConfigured()) return "off";
  let a = await getTikTok();
  if (!a || a.status !== "ok") return a ? "expired" : "not connected";
  const refresh = decrypt(a.refresh);
  if (!refresh) { await markExpired(a); return "expired"; }
  // Access tokens only last 24 hours, so renew on every sync (also extends the refresh token).
  const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: refresh });
  if (!t.access_token) { if (t.error === "invalid_grant") await markExpired(a); return "error"; }
  a = {
    ...a, token: encrypt(t.access_token), refresh: t.refresh_token ? encrypt(t.refresh_token) : a.refresh,
    expires_at: expiry(t.expires_in, 86_400), refresh_expires_at: t.refresh_expires_in ? expiry(t.refresh_expires_in, 31_536_000) : a.refresh_expires_at,
  };
  await saveAccount(a);
  const token = t.access_token;
  const u = await api<{ user?: { username?: string; follower_count?: number; likes_count?: number; video_count?: number } }>("/user/info/?fields=username,follower_count,likes_count,video_count", token);
  if (!u.ok) { if (u.code === "access_token_invalid") await markExpired(a); return "error"; }
  const user = u.data?.user ?? {};
  const s = await getSettings();
  const today = todayIn(s!.timezone);
  if (typeof user.follower_count === "number") {
    await sql`
      insert into stats_snapshots (platform, value, captured_on, source) values ('tiktok', ${user.follower_count}, ${today}, 'tiktok')
      on conflict (platform, captured_on) do update set value = excluded.value, source = 'tiktok'`;
  }
  // Latest 100 videos (TikTok returns up to 20 per page).
  const videos: Video[] = [];
  let cursor: number | undefined;
  for (let page = 0; page < 5; page++) {
    const r = await api<{ videos?: Video[]; cursor?: number; has_more?: boolean }>(
      "/video/list/?fields=id,title,video_description,create_time,cover_image_url,share_url,duration,view_count,like_count,comment_count,share_count", token,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ max_count: 20, ...(cursor ? { cursor } : {}) }) });
    if (!r.ok) break;
    videos.push(...(r.data?.videos ?? []));
    if (!r.data?.has_more) break;
    cursor = r.data.cursor;
  }
  for (const v of videos) {
    const title = (v.title || v.video_description || "").split("\n")[0].slice(0, 140) || "TikTok video";
    await sql`
      insert into posts (platform, post_id, title, url, thumbnail, kind, published_at, caption, duration_s)
      values ('tiktok', ${v.id}, ${title}, ${v.share_url ?? null}, ${v.cover_image_url ?? null}, 'video', ${v.create_time ? new Date(v.create_time * 1000) : null}, ${(v.video_description || v.title || "").slice(0, 1000)}, ${v.duration ?? null})
      on conflict (platform, post_id) do update set title = excluded.title, url = excluded.url, thumbnail = excluded.thumbnail, caption = excluded.caption, duration_s = excluded.duration_s`;
    await sql`
      insert into post_snapshots (platform, post_id, captured_on, views, likes, comments, shares)
      values ('tiktok', ${v.id}, ${today}, ${v.view_count ?? null}, ${v.like_count ?? null}, ${v.comment_count ?? null}, ${v.share_count ?? null})
      on conflict (platform, post_id, captured_on) do update set views = excluded.views, likes = excluded.likes, comments = excluded.comments, shares = excluded.shares`;
  }
  await saveAccount({ ...a, username: user.username ?? a.username, followers: user.follower_count ?? a.followers, likes: user.likes_count ?? a.likes, video_count: user.video_count ?? a.video_count, synced_at: new Date().toISOString() });
  return `ok · ${videos.length} videos`;
}

/** Disconnect: tell TikTok to revoke access (best effort), then forget the tokens. */
export async function disconnectTikTok() {
  const a = await getTikTok();
  const token = a && decrypt(a.token);
  if (token) {
    await fetch(`${API}/oauth/revoke/`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_key: process.env.TIKTOK_CLIENT_KEY!, client_secret: process.env.TIKTOK_CLIENT_SECRET!, token }), signal: AbortSignal.timeout(8000) }).catch(() => {});
  }
  await saveAccount(null);
}
