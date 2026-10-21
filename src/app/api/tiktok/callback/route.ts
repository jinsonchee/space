import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { currentMember, atLeast } from "@/lib/auth";
import { connectTikTok } from "@/lib/tiktok";

export const dynamic = "force-dynamic";

/** TikTok sends the artist back here after they allow (or cancel) access. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (result: string) => {
    const res = NextResponse.redirect(new URL(`/settings?tiktok=${result}#tiktok`, req.url));
    res.cookies.delete({ name: "space_ttstate", path: "/api/tiktok" });
    return res;
  };
  const me = await currentMember();
  if (!me || !atLeast(me, "admin")) return NextResponse.redirect(new URL("/login", req.url));
  const expected = (await cookies()).get("space_ttstate")?.value;
  if (!expected || url.searchParams.get("state") !== expected) return back("failed");
  if (url.searchParams.get("error")) return back("cancelled");
  const code = url.searchParams.get("code");
  if (!code) return back("failed");
  const r = await connectTikTok(code).catch(() => ({ ok: false as const }));
  return back(r.ok ? "connected" : "failed");
}
