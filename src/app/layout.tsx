import type { Metadata, Viewport } from "next";
import { Inter_Tight } from "next/font/google";
import "./globals.css";
import { getSettings } from "@/lib/db";
import { currentMember } from "@/lib/auth";
import { inkFor, isHex } from "@/lib/color";
import { BRAND } from "@/lib/brand";
import { MotionProvider } from "@/components/MotionProvider";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings().catch(() => null);
  const title = s ? `${s.artist_name}'s Space` : "Space";
  return { title, description: "Your artist command centre.", appleWebApp: { capable: true, title, statusBarStyle: "black-translucent" } };
}

// Headline font. Self-hosted by Next at build time; exposed to CSS as --font-inter-tight (see globals.css --font-head).
const interTight = Inter_Tight({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-inter-tight", display: "swap" });

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#0c0c0f" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [s, me] = await Promise.all([getSettings().catch(() => null), currentMember().catch(() => null)]);
  const accent = isHex(s?.accent) ? s!.accent : BRAND.accent;
  const theme = me?.theme ?? "dark";
  return (
    <html lang="en" className={interTight.variable} data-theme={theme} style={{ ["--accent" as string]: accent, ["--accent-ink" as string]: inkFor(accent) }}>
      <body><MotionProvider>{children}</MotionProvider></body>
    </html>
  );
}
