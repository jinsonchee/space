import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { currentMember, atLeast } from "@/lib/auth";
import { igAuthUrl, instagramConfigured } from "@/lib/instagram";

export const dynamic = "force-dynamic";

/** Artist/admins: start connecting the Space's Instagram account. */
export async function GET(req: Request) {
  const me = await currentMember();
  if (!me) return NextResponse.redirect(new URL("/login", req.url));
  if (!atLeast(me, "admin") || !instagramConfigured()) return NextResponse.redirect(new URL("/settings?instagram=unavailable#instagram", req.url));
  const state = randomBytes(24).toString("base64url");
  const res = NextResponse.redirect(igAuthUrl(state));
  res.cookies.set("space_igstate", state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/api/instagram", maxAge: 600 });
  return res;
}
