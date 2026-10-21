import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { currentMember } from "@/lib/auth";
import { connectWithCode, type GoogleFeature } from "@/lib/google";

export const dynamic = "force-dynamic";

/** Google sends the person back here after they allow (or cancel) calendar access. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (result: string) => {
    const res = NextResponse.redirect(new URL(`/profile?google=${result}#google`, req.url));
    res.cookies.delete({ name: "space_gstate", path: "/api/google" });
    return res;
  };
  const me = await currentMember();
  if (!me) return NextResponse.redirect(new URL("/login", req.url));
  const [expected, wanted = "calendar"] = ((await cookies()).get("space_gstate")?.value ?? "").split("|");
  const features = wanted.split(",").filter((f): f is GoogleFeature => f === "calendar" || f === "gmail");
  const state = url.searchParams.get("state");
  if (!expected || state !== expected) {
    console.error(`[calendar] connect failed: ${expected ? "state mismatch" : "state cookie missing"}`);
    return back("failed");
  }
  if (url.searchParams.get("error")) return back("cancelled");
  const code = url.searchParams.get("code");
  if (!code) return back("failed");
  const r = await connectWithCode(me.id, code, features).catch((e: Error) => {
    console.error(`[calendar] connect failed: ${e.name}: ${e.message}`);
    return { ok: false as const, reason: "exchange" };
  });
  return back(r.ok ? "connected" : r.reason === "scope" ? "noscope" : "failed");
}
