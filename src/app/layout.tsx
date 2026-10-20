import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getSettings } from "@/lib/db";
import { currentMember } from "@/lib/auth";
import { inkFor, isHex } from "@/lib/color";
import { BRAND } from "@/lib/brand";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings().catch(() => null);
  const title = s ? `${s.artist_name}'s Space` : "Space";
  return { title, description: "Your artist command centre.", appleWebApp: { capable: true, title, statusBarStyle: "black-translucent" } };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#0c0c0f" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [s, me] = await Promise.all([getSettings().catch(() => null), currentMember().catch(() => null)]);
  const accent = isHex(s?.accent) ? s!.accent : BRAND.accent;
  const theme = me?.theme ?? "dark";
  return (
    <html lang="en" data-theme={theme} style={{ ["--accent" as string]: accent, ["--accent-ink" as string]: inkFor(accent) }}>
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600,700&display=swap" rel="stylesheet" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
