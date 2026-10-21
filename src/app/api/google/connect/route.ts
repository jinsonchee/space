import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { currentMember } from "@/lib/auth";
import { authUrl, calendarConfigured } from "@/lib/google";

export const dynamic = "force-dynamic";

/** Starts "Connect Google Calendar": sends the person to Google's sign-in screen. */
export async function GET(req: Request) {
  const me = await currentMember();
  if (!me) return NextResponse.redirect(new URL("/login", req.url));
  if (!calendarConfigured()) return NextResponse.redirect(new URL("/profile?calendar=unavailable#calendar", req.url));
  const state = randomBytes(24).toString("base64url"); // proves the reply from Google is for this request
  const res = NextResponse.redirect(authUrl(state, me.email));
  res.cookies.set("space_gstate", state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/api/google", maxAge: 600 });
  return res;
}
