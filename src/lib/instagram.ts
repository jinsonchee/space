import "server-only";
import { sql, getSettings } from "./db";
import { encrypt, decrypt } from "./crypto";
import { todayIn } from "./dates";
import { notify } from "./notify";

// Instagram stats via the Instagram API with Instagram Login, through the publisher's Meta app
// (INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET) in Development mode: the artist's Instagram is added
// as an "Instagram tester" on that app. The token is encrypted and stored only in the artist's
// own database. Long-lived tokens last 60 days; sync renews them well before that.

const GRAPH = "https://graph.instagram.com/v23.0";
export const IG_SCOPES = "instagram_business_basic,instagram_business_manage_insights";

export type IgAccount = { user_id: string; username: string; token: string; expires_at: string; status: "ok" | "expired"; followers: number | null; media_count: number | null; synced_at: string | null; connected_at: string };

export const instagramConfigured = () => Boolean(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET && process.env.APP_URL);
export const igRedirectUri = () => `${process.env.APP_URL!.replace(/\/$/, "")}/api/instagram/callback`;

export function igAuthUrl(state: string) {
  return `https://www.instagram.com/oauth/authorize?${new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID!, redirect_uri: igRedirectUri(), response_type: "code", scope: IG_SCOPES, state,
  })}`;
}

export async function getInstagram(): Promise<IgAccount | null> {
  const [r] = await sql<{ instagram: IgAccount | null }[]>`select instagram from settings where id = 1`;
  return r?.instagram ?? null;
}
const saveAccount = (a: IgAccount | null) => sql`update settings set instagram = ${a ? sql.json(a as never) : null} where id = 1`;

const ig = async <T>(path: string, token: string, params: Record<string, string> = {}) => {
  const res = await fetch(`${GRAPH}${path}?${new URLSearchParams({ ...params, access_token: token })}`, { signal: AbortSignal.timeout(10000), cache: "no-store" });
  const body = (await res.json().catch(() => ({}))) as T & { error?: { code?: number; message?: string } };
  if (!res.ok) console.error(`[instagram] ${path.replace(/\/\d{6,}/g, "/:id")} → ${res.status} ${body.error?.code ?? ""}`);
  return { ok: res.ok, body };
};

/** Finishes "Connect Instagram": one-time code → short-lived token → 60-day token, saved encrypted. */
export async function connectInstagram(code: string) {
  const short = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.INSTAGRAM_APP_ID!, client_secret: process.env.INSTAGRAM_APP_SECRET!, grant_type: "authorization_code", redirect_uri: igRedirectUri(), code }),
    signal: AbortSignal.timeout(10000),
  });
  const s = (await short.json().catch(() => ({}))) as { access_token?: string; user_id?: number | string; error_message?: string };
  if (!short.ok || !s.access_token) { console.error(`[instagram] connect failed: ${short.status}`); return { ok: false as const }; }
  const long = await ig<{ access_token?: string; expires_in?: number }>("/access_token", s.access_token, { grant_type: "ig_exchange_token", client_secret: process.env.INSTAGRAM_APP_SECRET! });
  if (!long.ok || !long.body.access_token) return { ok: false as const };
  const me = await ig<{ user_id?: string; username?: string; followers_count?: number; media_count?: number }>("/me", long.body.access_token, { fields: "user_id,username,followers_count,media_count" });
  if (!me.ok) return { ok: false as const };
  await saveAccount({
    user_id: String(me.body.user_id ?? s.user_id ?? ""), username: me.body.username ?? "", token: encrypt(long.body.access_token),
    expires_at: new Date(Date.now() + (long.body.expires_in ?? 5_184_000) * 1000).toISOString(), status: "ok",
    followers: me.body.followers_count ?? null, media_count: me.body.media_count ?? null, synced_at: null, connected_at: new Date().toISOString(),
  });
  await syncInstagram();
  return { ok: true as const };
}

async function markExpired(a: IgAccount) {
  if (a.status === "expired") return;
  await saveAccount({ ...a, status: "expired" });
  const [artist] = await sql<{ id: string }[]>`select id from members where access = 'master' order by created_at limit 1`;
  if (artist) await notify({ memberId: artist.id, kind: "instagram", title: "Reconnect Instagram 📸", body: "Instagram stopped sharing your stats with Space. Reconnect it in Settings (10 seconds).", link: "/settings#instagram", dedupeKey: `instagram-expired:${a.connected_at}` });
}

type Media = { id: string; caption?: string; media_type?: string; media_product_type?: string; timestamp?: string; permalink?: string; thumbnail_url?: string; media_url?: string; like_count?: number; comments_count?: number };

/** Daily: renew the token if needed, save followers for Home, and every recent post's numbers. */
export async function syncInstagram() {
  if (!instagramConfigured()) return "off";
  let a = await getInstagram();
  if (!a || a.status !== "ok") return a ? "expired" : "not connected";
  let token = decrypt(a.token);
  if (!token) { await markExpired(a); return "expired"; }
  // Renew once fewer than 20 days are left (tokens must be at least a day old to renew).
  if (Date.parse(a.expires_at) - Date.now() < 20 * 86_400_000) {
    const r = await ig<{ access_token?: string; expires_in?: number }>("/refresh_access_token", token, { grant_type: "ig_refresh_token" });
    if (r.ok && r.body.access_token) {
      token = r.body.access_token;
      a = { ...a, token: encrypt(token), expires_at: new Date(Date.now() + (r.body.expires_in ?? 5_184_000) * 1000).toISOString() };
      await saveAccount(a);
    }
  }
  const me = await ig<{ username?: string; followers_count?: number; media_count?: number; error?: { code?: number } }>("/me", token, { fields: "username,followers_count,media_count" });
  if (!me.ok) { if (me.body.error?.code === 190) await markExpired(a); return "error"; }
  const s = await getSettings();
  const today = todayIn(s!.timezone);
  if (typeof me.body.followers_count === "number") {
    await sql`
      insert into stats_snapshots (platform, value, captured_on, source) values ('instagram', ${me.body.followers_count}, ${today}, 'instagram')
      on conflict (platform, captured_on) do update set value = excluded.value, source = 'instagram'`;
  }
  // Latest 100 posts.
  const media: Media[] = [];
  let after: string | undefined;
  do {
    const r = await ig<{ data?: Media[]; paging?: { cursors?: { after?: string }; next?: string } }>("/me/media", token, {
      fields: "id,caption,media_type,media_product_type,timestamp,permalink,thumbnail_url,media_url,like_count,comments_count", limit: "50", ...(after ? { after } : {}),
    });
    if (!r.ok) break;
    media.push(...(r.body.data ?? []));
    after = r.body.paging?.next ? r.body.paging.cursors?.after : undefined;
  } while (after && media.length < 100);
  for (const m of media) {
    const kind = m.media_product_type === "REELS" ? "reel" : m.media_type === "CAROUSEL_ALBUM" ? "carousel" : m.media_type === "VIDEO" ? "video" : "photo";
    const title = (m.caption ?? "").split("\n")[0].slice(0, 140) || (kind === "reel" ? "Reel" : "Post");
    await sql`
      insert into posts (platform, post_id, title, url, thumbnail, kind, published_at, caption)
      values ('instagram', ${m.id}, ${title}, ${m.permalink ?? null}, ${m.thumbnail_url ?? m.media_url ?? null}, ${kind}, ${m.timestamp ?? null}, ${(m.caption ?? "").slice(0, 1000)})
      on conflict (platform, post_id) do update set title = excluded.title, url = excluded.url, thumbnail = excluded.thumbnail, kind = excluded.kind, caption = excluded.caption`;
    const ins = await ig<{ data?: { name: string; values?: { value: number }[]; total_value?: { value: number } }[] }>(`/${m.id}/insights`, token, { metric: "views,reach,saved,shares" });
    const v = (name: string) => { const d = ins.body.data?.find((x) => x.name === name); return d ? d.values?.[0]?.value ?? d.total_value?.value ?? null : null; };
    await sql`
      insert into post_snapshots (platform, post_id, captured_on, views, likes, comments, shares, saves, reach)
      values ('instagram', ${m.id}, ${today}, ${v("views")}, ${m.like_count ?? null}, ${m.comments_count ?? null}, ${v("shares")}, ${v("saved")}, ${v("reach")})
      on conflict (platform, post_id, captured_on) do update set views = excluded.views, likes = excluded.likes, comments = excluded.comments, shares = excluded.shares, saves = excluded.saves, reach = excluded.reach`;
  }
  await saveAccount({ ...a, username: me.body.username ?? a.username, followers: me.body.followers_count ?? a.followers, media_count: me.body.media_count ?? a.media_count, synced_at: new Date().toISOString() });
  return `ok · ${media.length} posts`;
}

export async function disconnectInstagram() {
  await saveAccount(null);
}
