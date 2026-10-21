import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { currentMember } from "@/lib/auth";
import { authUrl, calendarConfigured, getConnection, type GoogleFeature } from "@/lib/google";

export const dynamic = "force-dynamic";

/**
 * Starts connecting Google: sends the person to Google's sign-in screen.
 * ?want=calendar|gmail adds that feature to whatever they already have on.
 */
export async function GET(req: Request) {
  const me = await currentMember();
  if (!me) return NextResponse.redirect(new URL("/login", req.url));
  if (!calendarConfigured()) return NextResponse.redirect(new URL("/profile?google=unavailable#google", req.url));
  const want = new URL(req.url).searchParams.get("want");
  const current = (await getConnection(me.id))?.features ?? [];
  const features = [...new Set<GoogleFeature>([...current, want === "gmail" ? "gmail" : "calendar"])];
  const state = randomBytes(24).toString("base64url"); // proves the reply from Google is for this request
  const res = NextResponse.redirect(authUrl(state, features));
  res.cookies.set("space_gstate", `${state}|${features.join(",")}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/api/google", maxAge: 600 });
  return res;
}
