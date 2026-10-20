import type { MetadataRoute } from "next";
import { getSettings } from "@/lib/db";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const s = await getSettings().catch(() => null);
  const name = s ? `${s.artist_name}'s Space` : "Space";
  return {
    name,
    short_name: name,
    start_url: "/",
    display: "standalone",
    background_color: "#0c0c0f",
    theme_color: "#0c0c0f",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
