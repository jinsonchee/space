import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { sql, memberCols, type Member, type Access } from "./db";

const COOKIE = "space_session";
const DEVICE = "space_device"; // remembers who last logged in on this device (not a credential)

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET must be set (at least 16 characters)");
  return new TextEncoder().encode(s);
}

export async function createSession(memberId: string) {
  const token = await new SignJWT({ sub: memberId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
  const jar = await cookies();
  const base = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };
  jar.set(COOKIE, token, { ...base, maxAge: 60 * 60 * 24 * 30 });
  jar.set(DEVICE, memberId, { ...base, maxAge: 60 * 60 * 24 * 365 });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function forgetDevice() {
  (await cookies()).delete(DEVICE);
}

export async function rememberedMemberId() {
  return (await cookies()).get(DEVICE)?.value ?? null;
}

export async function currentMember(): Promise<Member | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  let sub: string | undefined;
  try {
    sub = (await jwtVerify(token, secret())).payload.sub;
  } catch {
    return null; // bad or expired token = logged out
  }
  if (!sub) return null;
  // Database errors are thrown, not treated as "logged out" — otherwise / and /login
  // bounce between each other forever when the database is briefly unavailable.
  const rows = await sql<Member[]>`select ${memberCols} from members where id = ${sub}`;
  return rows[0] ?? null;
}

export async function requireMember(): Promise<Member> {
  const m = await currentMember();
  if (!m) redirect("/login");
  return m;
}

const rank: Record<Access, number> = { member: 0, admin: 1, master: 2 };
export function atLeast(m: Member, a: Access) {
  return rank[m.access] >= rank[a];
}

export async function requireAccess(a: Access) {
  const m = await requireMember();
  if (!atLeast(m, a)) throw new Error("You don't have permission to do that.");
  return m;
}

export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}
