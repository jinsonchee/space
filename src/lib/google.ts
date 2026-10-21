import "server-only";
import { sql } from "./db";
import { encrypt, decrypt } from "./crypto";
import { notify } from "./notify";
import { tzOffset, todayIn, addDays, timeIn } from "./dates";

// Google Calendar, read-only, main calendar only. Each artist uses their own Google Cloud
// app (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET). Tokens are encrypted and stored only in
// the artist's own database.

export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events.readonly";
const SCOPES = ["openid", "email", CALENDAR_SCOPE].join(" ");
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const TIMEOUT = 5000; // never let a slow Google response hold up a page

export function calendarConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.APP_URL);
}

export function redirectUri() {
  return `${process.env.APP_URL!.replace(/\/$/, "")}/api/google/callback`;
}

export function authUrl(state: string, loginHint?: string | null) {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES,
    access_type: "offline", // gives a refresh token so the connection lasts
    prompt: "consent", // always return a refresh token, even on reconnect
    state,
  });
  if (loginHint) p.set("login_hint", loginHint);
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

type TokenResponse = { access_token: string; expires_in: number; refresh_token?: string; scope?: string; id_token?: string; error?: string };

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, ...body }),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  return { ok: res.ok, data: (await res.json().catch(() => ({}))) as TokenResponse };
}

/** Finishes the Google sign-in: swaps the one-time code for tokens and saves them encrypted. */
export async function connectWithCode(memberId: string, code: string) {
  const { ok, data } = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri() });
  if (!ok || !data.refresh_token) {
    // Log Google's error code only (never tokens or secrets) so failed connections can be diagnosed.
    console.error(`[calendar] connect failed: ${!ok ? `google error ${data.error ?? "unknown"}` : "no refresh token returned"}`);
    return { ok: false as const, reason: "exchange" };
  }
  if (!data.scope?.split(" ").includes(CALENDAR_SCOPE)) return { ok: false as const, reason: "scope" };
  // The id_token comes straight from Google over HTTPS; we only read the email from it.
  let email: string | null = null;
  try { email = JSON.parse(Buffer.from(data.id_token!.split(".")[1], "base64url").toString()).email ?? null; } catch {}
  await sql`
    insert into calendar_connections (member_id, google_email, refresh_token, access_token, access_expires_at, status, connected_at)
    values (${memberId}, ${email}, ${encrypt(data.refresh_token)}, ${encrypt(data.access_token)}, ${new Date(Date.now() + data.expires_in * 1000)}, 'ok', now())
    on conflict (member_id) do update set google_email = excluded.google_email, refresh_token = excluded.refresh_token,
      access_token = excluded.access_token, access_expires_at = excluded.access_expires_at, status = 'ok', connected_at = now()`;
  return { ok: true as const };
}

export async function getConnection(memberId: string) {
  const [c] = await sql<{ google_email: string | null; status: "ok" | "expired"; connected_at: string }[]>`
    select google_email, status, connected_at from calendar_connections where member_id = ${memberId}`;
  return c ?? null;
}

export async function disconnect(memberId: string) {
  const [c] = await sql<{ refresh_token: string }[]>`delete from calendar_connections where member_id = ${memberId} returning refresh_token`;
  const token = c && decrypt(c.refresh_token);
  // Tell Google to forget the permission too (best effort).
  if (token) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: "POST", signal: AbortSignal.timeout(TIMEOUT) }).catch(() => {});
}

/** Marks the connection expired and has the dove ask them to reconnect (once per connection). */
async function markExpired(memberId: string) {
  const rows = await sql<{ connected_at: string }[]>`
    update calendar_connections set status = 'expired' where member_id = ${memberId} and status = 'ok' returning connected_at::text`;
  if (!rows.length) return;
  await notify({
    memberId,
    kind: "calendar",
    title: "Reconnect your Google Calendar 🗓️",
    body: "Your calendar connection has expired, so your events aren't showing. It takes 10 seconds to reconnect.",
    link: "/profile#calendar",
    dedupeKey: `calendar-expired:${rows[0].connected_at}`,
  });
}

async function accessToken(memberId: string, forceRefresh = false): Promise<string | null> {
  const [c] = await sql<{ refresh_token: string; access_token: string | null; access_expires_at: Date | null; status: string }[]>`
    select refresh_token, access_token, access_expires_at, status from calendar_connections where member_id = ${memberId}`;
  if (!c || c.status !== "ok") return null;
  if (!forceRefresh && c.access_token && c.access_expires_at && c.access_expires_at.getTime() > Date.now() + 60_000) {
    const t = decrypt(c.access_token);
    if (t) return t;
  }
  const refresh = decrypt(c.refresh_token);
  if (!refresh) { await markExpired(memberId); return null; }
  const { ok, data } = await tokenRequest({ grant_type: "refresh_token", refresh_token: refresh });
  if (!ok) {
    // invalid_grant = revoked, expired, or password changed: they need to reconnect.
    if (data.error === "invalid_grant") await markExpired(memberId);
    return null;
  }
  await sql`update calendar_connections set access_token = ${encrypt(data.access_token)}, access_expires_at = ${new Date(Date.now() + data.expires_in * 1000)} where member_id = ${memberId}`;
  return data.access_token;
}

export type CalEvent = {
  id: string;
  title: string;
  location: string | null;
  allDay: boolean;
  start: string; // ISO time, or YYYY-MM-DD for all-day
  end: string; // exclusive
  startMs: number;
  endMs: number;
  time: string; // "14:30–15:30" or "All day"
};

export type CalendarResult =
  | { state: "off" } // Google not set up for this Space, or this person hasn't connected
  | { state: "expired" }
  | { state: "error" }
  | { state: "ok"; events: CalEvent[] };

type GEvent = {
  id: string; status?: string; summary?: string; location?: string;
  start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string };
  attendees?: { self?: boolean; responseStatus?: string }[];
};

/** Events on the main calendar between two dates (inclusive), in the Space's timezone. */
export async function eventsBetween(memberId: string, from: string, to: string, tz: string): Promise<CalendarResult> {
  if (!calendarConfigured()) return { state: "off" };
  const conn = await getConnection(memberId);
  if (!conn) return { state: "off" };
  if (conn.status === "expired") return { state: "expired" };
  try {
    const p = new URLSearchParams({
      timeMin: `${from}T00:00:00${tzOffset(tz, from)}`,
      timeMax: `${addDays(to, 1)}T00:00:00${tzOffset(tz, addDays(to, 1))}`,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
      timeZone: tz,
    });
    const get = (token: string) =>
      fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${p}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(TIMEOUT), cache: "no-store" });
    let token = await accessToken(memberId);
    if (!token) return (await getConnection(memberId))?.status === "expired" ? { state: "expired" } : { state: "error" };
    let res = await get(token);
    if (res.status === 401) {
      token = await accessToken(memberId, true);
      if (!token) return (await getConnection(memberId))?.status === "expired" ? { state: "expired" } : { state: "error" };
      res = await get(token);
    }
    if (res.status === 401 || res.status === 403) { await markExpired(memberId); return { state: "expired" }; }
    if (!res.ok) return { state: "error" };
    const items = ((await res.json()) as { items?: GEvent[] }).items ?? [];
    const events = items
      .filter((e) => e.status !== "cancelled" && !e.attendees?.some((a) => a.self && a.responseStatus === "declined"))
      .map((e): CalEvent => {
        const allDay = !e.start?.dateTime;
        const start = e.start?.dateTime ?? e.start?.date ?? from;
        const end = e.end?.dateTime ?? e.end?.date ?? start;
        const startMs = allDay ? Date.parse(`${start}T00:00:00${tzOffset(tz, start)}`) : Date.parse(start);
        const endMs = allDay ? Date.parse(`${end}T00:00:00${tzOffset(tz, end)}`) : Date.parse(end);
        return {
          id: e.id, title: e.summary?.trim() || "(No title)", location: e.location?.trim() || null, allDay, start, end, startMs, endMs,
          time: allDay ? "All day" : `${timeIn(tz, new Date(startMs))}–${timeIn(tz, new Date(endMs))}`,
        };
      });
    return { state: "ok", events };
  } catch {
    return { state: "error" };
  }
}

/** Which events fall on a given day (all-day events can span several days). */
export function eventsOn(events: CalEvent[], day: string, tz: string) {
  return events.filter((e) => (e.allDay ? e.start <= day && day < e.end : todayIn(tz, new Date(e.startMs)) === day));
}
