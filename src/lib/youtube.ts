import "server-only";
import { sql, getSettings } from "./db";
import { todayIn } from "./dates";

// Public YouTube channel numbers (subscribers, views, videos) via the YouTube Data API with an
// API key from the artist's own Google Cloud project (YOUTUBE_API_KEY). No sign-in needed.
// Each lookup costs 1 unit of the free 10,000/day. YouTube rounds public subscriber counts.

export type YouTubeChannel = { id: string; title: string; subscribers: number | null; views: number; videos: number; hidden: boolean; synced_at: string };

export const youtubeConfigured = () => Boolean(process.env.YOUTUBE_API_KEY);

/** Accepts "@handle", "handle", a youtube.com/@handle link, or a channel ID (UC…). */
function channelQuery(input: string): Record<string, string> | null {
  const v = input.trim();
  const id = v.match(/(UC[\w-]{22})/)?.[1];
  if (id) return { id };
  const handle = v.match(/youtube\.com\/@([\w.-]+)/i)?.[1] ?? v.replace(/^@/, "");
  return /^[\w.-]{3,30}$/.test(handle) ? { forHandle: `@${handle}` } : null;
}

export async function lookupChannel(input: string): Promise<{ ok: true; channel: YouTubeChannel } | { ok: false; error: string }> {
  if (!youtubeConfigured()) return { ok: false, error: "YouTube isn't set up for this Space yet." };
  const q = channelQuery(input);
  if (!q) return { ok: false, error: "That doesn't look like a YouTube handle. Try something like @layyi." };
  try {
    const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?${new URLSearchParams({ part: "snippet,statistics", ...q, key: process.env.YOUTUBE_API_KEY! })}`, { signal: AbortSignal.timeout(8000), cache: "no-store" });
    const data = (await res.json()) as { items?: { id: string; snippet: { title: string }; statistics: { subscriberCount?: string; viewCount?: string; videoCount?: string; hiddenSubscriberCount?: boolean } }[]; error?: { message?: string; errors?: { reason?: string }[] } };
    if (!res.ok) {
      const reason = data.error?.errors?.[0]?.reason ?? String(res.status);
      console.error(`[youtube] lookup failed: ${reason}`);
      return { ok: false, error: reason === "keyInvalid" || reason === "API_KEY_INVALID" ? "The YouTube key isn't valid." : reason === "accessNotConfigured" ? "The YouTube Data API isn't switched on in Google Cloud." : "YouTube didn't answer. Try again in a minute." };
    }
    const c = data.items?.[0];
    if (!c) return { ok: false, error: "Couldn't find that channel. Check the handle on the channel page (it starts with @)." };
    const st = c.statistics;
    return {
      ok: true,
      channel: {
        id: c.id, title: c.snippet.title, hidden: Boolean(st.hiddenSubscriberCount),
        subscribers: st.hiddenSubscriberCount ? null : Number(st.subscriberCount ?? 0),
        views: Number(st.viewCount ?? 0), videos: Number(st.videoCount ?? 0), synced_at: new Date().toISOString(),
      },
    };
  } catch (e) {
    console.error(`[youtube] lookup failed: ${(e as Error).name}`);
    return { ok: false, error: "YouTube didn't answer. Try again in a minute." };
  }
}

export async function getYouTube() {
  const [r] = await sql<{ youtube_handle: string | null; youtube_channel: YouTubeChannel | null }[]>`select youtube_handle, youtube_channel from settings where id = 1`;
  return { handle: r?.youtube_handle ?? null, channel: r?.youtube_channel ?? null };
}

/** Saves today's subscriber count (overwrites a manual entry for today). Safe to run any number of times. */
export async function saveChannel(handle: string, channel: YouTubeChannel) {
  await sql`update settings set youtube_handle = ${handle}, youtube_channel = ${sql.json(channel as never)} where id = 1`;
  if (channel.subscribers === null) return;
  const s = await getSettings();
  await sql`
    insert into stats_snapshots (platform, value, captured_on, source) values ('youtube', ${channel.subscribers}, ${todayIn(s!.timezone)}, 'youtube')
    on conflict (platform, captured_on) do update set value = excluded.value, source = 'youtube'`;
}

/** Daily refresh (called by the cron). */
export async function syncYouTube() {
  if (!youtubeConfigured()) return "off";
  const { handle, channel } = await getYouTube();
  if (!handle || !channel) return "no channel";
  const r = await lookupChannel(channel.id);
  if (!r.ok) return `error: ${r.error}`;
  await saveChannel(handle, r.channel);
  return "ok";
}
