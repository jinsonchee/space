/** Platforms tracked on Home, plus number formatting. */

export const PLATFORMS = [
  { key: "spotify", name: "Spotify", metric: "monthly listeners", color: "#1ed760" },
  { key: "youtube", name: "YouTube", metric: "subscribers", color: "#ff3b30" },
  { key: "instagram", name: "Instagram", metric: "followers", color: "#e1306c" },
  { key: "tiktok", name: "TikTok", metric: "followers", color: "#25f4ee" },
  { key: "facebook", name: "Facebook", metric: "followers", color: "#1877f2" },
  { key: "apple_music", name: "Apple Music", metric: "listeners", color: "#fa2d48" },
] as const;

export type PlatformKey = (typeof PLATFORMS)[number]["key"];

export function compact(n: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}
