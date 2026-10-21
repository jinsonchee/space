import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { currentMember, atLeast } from "@/lib/auth";
import { ttAuthUrl, tiktokConfigured } from "@/lib/tiktok";

export const dynamic = "force-dynamic";

/** Artist/admins: start connecting the Space's TikTok account. */
export async function GET(req: Request) {
  const me = await currentMember();
  if (!me) return NextResponse.redirect(new URL("/login", req.url));
  if (!atLeast(me, "admin") || !tiktokConfigured()) return NextResponse.redirect(new URL("/settings?tiktok=unavailable#tiktok", req.url));
  const state = randomBytes(24).toString("base64url");
  const res = NextResponse.redirect(ttAuthUrl(state));
  res.cookies.set("space_ttstate", state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/api/tiktok", maxAge: 600 });
  return res;
}
