"use server";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { sql, type AvatarConfig } from "@/lib/db";
import { createSession, destroySession, forgetDevice, clientIp } from "@/lib/auth";
import { isHex } from "@/lib/color";
import { presetFor } from "@/lib/characters";

export type Result = { ok: true } | { ok: false; error: string };
const PIN_RE = /^\d{6}$/;
const MAX_FAILS = 5;
const LOCK_MIN = 15;

async function ipLimited() {
  const ip = await clientIp();
  await sql`delete from login_attempts where at < now() - interval '15 minutes'`;
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from login_attempts where ip = ${ip}`;
  if (n >= 30) return true;
  await sql`insert into login_attempts (ip) values (${ip})`;
  return false;
}

export async function setupSpace(_: unknown, fd: FormData): Promise<Result> {
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from members`;
  if (n > 0) return { ok: false, error: "This Space is already set up." };
  const code = String(fd.get("setupCode") ?? "");
  if (!process.env.SETUP_CODE || code !== process.env.SETUP_CODE) return { ok: false, error: "That setup code doesn't match. It's the SETUP_CODE you set when deploying." };
  const artist = String(fd.get("artist") ?? "").trim();
  const name = String(fd.get("name") ?? "").trim();
  const email = String(fd.get("email") ?? "").trim().toLowerCase() || null;
  const pin = String(fd.get("pin") ?? "");
  const pin2 = String(fd.get("pin2") ?? "");
  const accent = String(fd.get("accent") ?? "#fa243c");
  if (!artist || !name) return { ok: false, error: "Add your artist name and your name." };
  if (!PIN_RE.test(pin)) return { ok: false, error: "Your PIN needs to be exactly 6 digits." };
  if (pin !== pin2) return { ok: false, error: "Those PINs don't match." };
  const hash = await bcrypt.hash(pin, 10);
  const preset = presetFor(artist);
  const avatar: AvatarConfig = preset?.avatar ?? { pet: "dove", petName: "Pip" };
  const photo = preset?.photo ?? null;
  let id = "";
  await sql.begin(async (tx) => {
    await tx`insert into settings (id, artist_name, accent) values (1, ${artist}, ${isHex(accent) ? accent : "#fa243c"})`;
    const [m] = await tx<{ id: string }[]>`
      insert into members (name, email, role_label, access, pin_hash, avatar, photo)
      values (${name}, ${email}, 'Artist', 'master', ${hash}, ${tx.json(avatar as never)}, ${photo}) returning id`;
    id = m.id;
    await tx`insert into labels (name, color) values ('Release', '#8b5cf6'), ('Content', '#ff4fa3'), ('Shoot', '#ffb020'), ('Admin', '#3b82f6')`;
  });
  await createSession(id);
  redirect("/?welcome=1");
}

export type PublicMember = { id: string; name: string; photo: string | null };

export async function findMember(_: unknown, fd: FormData): Promise<{ ok: true; member: PublicMember } | { ok: false; error: string }> {
  if (await ipLimited()) return { ok: false, error: "Too many tries. Take a breather and try again in 15 minutes." };
  const raw = String(fd.get("who") ?? "").trim();
  if (!raw) return { ok: false, error: "Enter your email or phone number." };
  const digits = raw.replace(/[^\d]/g, "");
  const rows = await sql<PublicMember[]>`
    select id, name, photo from members
    where lower(email) = ${raw.toLowerCase()}
       or (${digits.length >= 6} and regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') = ${digits})
    limit 1`;
  if (!rows[0]) return { ok: false, error: "We couldn't find that one. Check with your Space admin." };
  return { ok: true, member: rows[0] };
}

export async function loginWithPin(memberId: string, pin: string): Promise<Result> {
  if (await ipLimited()) return { ok: false, error: "Too many tries. Try again in 15 minutes." };
  if (!PIN_RE.test(pin)) return { ok: false, error: "PIN must be 6 digits." };
  const [m] = await sql<{ id: string; pin_hash: string; failed_attempts: number; locked_until: Date | null }[]>`
    select id, pin_hash, failed_attempts, locked_until from members where id = ${memberId}`;
  if (!m) return { ok: false, error: "Account not found." };
  if (m.locked_until && m.locked_until > new Date()) {
    const mins = Math.ceil((m.locked_until.getTime() - Date.now()) / 60000);
    return { ok: false, error: `Locked for ${mins} more min after too many wrong PINs.` };
  }
  const good = await bcrypt.compare(pin, m.pin_hash);
  if (!good) {
    const fails = m.failed_attempts + 1;
    if (fails >= MAX_FAILS) {
      await sql`update members set failed_attempts = 0, locked_until = now() + ${LOCK_MIN + " minutes"}::interval where id = ${m.id}`;
      return { ok: false, error: `Too many wrong PINs — locked for ${LOCK_MIN} minutes.` };
    }
    await sql`update members set failed_attempts = ${fails} where id = ${m.id}`;
    return { ok: false, error: `Wrong PIN. ${MAX_FAILS - fails} ${MAX_FAILS - fails === 1 ? "try" : "tries"} left.` };
  }
  await sql`update members set failed_attempts = 0, locked_until = null where id = ${m.id}`;
  await createSession(m.id);
  return { ok: true };
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

export async function notMe() {
  await forgetDevice();
  redirect("/login");
}
