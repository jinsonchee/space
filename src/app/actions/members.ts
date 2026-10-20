"use server";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { sql, type AvatarConfig, type Access, type Member } from "@/lib/db";
import { requireMember, atLeast } from "@/lib/auth";
import { presetFor } from "@/lib/characters";

const uuidRe = /^[0-9a-f-]{36}$/i;
type R<T = object> = ({ ok: true } & T) | { ok: false; error: string };

function newPin() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

async function target(id: string) {
  if (!uuidRe.test(id)) return null;
  const [t] = await sql<{ id: string; access: Access }[]>`select id, access from members where id = ${id}`;
  return t ?? null;
}

/** Can `me` edit member `t`? Self always; admins can edit non-masters; master can edit anyone. */
function canEdit(me: Member, t: { id: string; access: Access }) {
  if (me.id === t.id) return true;
  if (me.access === "master") return true;
  return me.access === "admin" && t.access !== "master";
}

function clean(v: unknown, max = 80) {
  return String(v ?? "").trim().slice(0, max);
}

export async function updateMember(id: string, data: { name: string; email: string; phone: string; role_label: string; access?: Access }): Promise<R> {
  const me = await requireMember();
  const t = await target(id);
  if (!t) return { ok: false, error: "Member not found." };
  if (!canEdit(me, t)) return { ok: false, error: "You can't edit this person." };
  const name = clean(data.name);
  if (!name) return { ok: false, error: "Name can't be empty." };
  const email = clean(data.email, 200).toLowerCase() || null;
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "That email doesn't look right." };
  const phone = clean(data.phone, 30) || null;
  const role = clean(data.role_label, 40) || "Team";
  let access = t.access;
  if (data.access && data.access !== t.access) {
    if (me.access !== "master") return { ok: false, error: "Only the master account can change access levels." };
    if (t.access === "master" || data.access === "master") return { ok: false, error: "There's only one master — that's the artist." };
    if (!["admin", "member"].includes(data.access)) return { ok: false, error: "Unknown access level." };
    access = data.access;
  }
  try {
    await sql`update members set name = ${name}, email = ${email}, phone = ${phone}, role_label = ${role}, access = ${access} where id = ${id}`;
  } catch (e) {
    if (String(e).includes("members_email_key")) return { ok: false, error: "Someone already uses that email." };
    throw e;
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function addMember(data: { name: string; email: string; phone: string; role_label: string; access: Access; preset?: string }): Promise<R<{ pin: string }>> {
  const me = await requireMember();
  if (!atLeast(me, "admin")) return { ok: false, error: "Only admins can add people." };
  const name = clean(data.name);
  const email = clean(data.email, 200).toLowerCase() || null;
  const phone = clean(data.phone, 30) || null;
  if (!name) return { ok: false, error: "Add a name." };
  if (!email && !phone) return { ok: false, error: "Add an email or phone — it's how they log in." };
  const access: Access = data.access === "admin" && me.access === "master" ? "admin" : "member";
  const pin = newPin();
  const preset = data.preset ? presetFor(data.preset) : null;
  const avatar: AvatarConfig = preset?.avatar ?? { hairStyle: "sidepart", topColor: "#2f3a56", bottom: "pants", bottomColor: "#2a2c33" };
  const photo = preset?.photo ?? null;
  try {
    await sql`insert into members (name, email, phone, role_label, access, pin_hash, avatar, photo)
      values (${name}, ${email}, ${phone}, ${clean(data.role_label, 40) || "Team"}, ${access}, ${await bcrypt.hash(pin, 10)}, ${sql.json(avatar as never)}, ${photo})`;
  } catch (e) {
    if (String(e).includes("members_email_key")) return { ok: false, error: "Someone already uses that email." };
    throw e;
  }
  revalidatePath("/team");
  return { ok: true, pin };
}

export async function resetPin(id: string): Promise<R<{ pin: string }>> {
  const me = await requireMember();
  const t = await target(id);
  if (!t) return { ok: false, error: "Member not found." };
  if (me.id === id || !canEdit(me, t) || !atLeast(me, "admin")) return { ok: false, error: "You can't reset this PIN." };
  const pin = newPin();
  await sql`update members set pin_hash = ${await bcrypt.hash(pin, 10)}, failed_attempts = 0, locked_until = null where id = ${id}`;
  return { ok: true, pin };
}

export async function changeMyPin(current: string, next: string): Promise<R> {
  const me = await requireMember();
  if (!/^\d{6}$/.test(next)) return { ok: false, error: "New PIN must be 6 digits." };
  const [row] = await sql<{ pin_hash: string }[]>`select pin_hash from members where id = ${me.id}`;
  if (!(await bcrypt.compare(current, row.pin_hash))) return { ok: false, error: "Current PIN is wrong." };
  await sql`update members set pin_hash = ${await bcrypt.hash(next, 10)} where id = ${me.id}`;
  return { ok: true };
}

export async function removeMember(id: string): Promise<R> {
  const me = await requireMember();
  const t = await target(id);
  if (!t) return { ok: false, error: "Member not found." };
  if (t.access === "master") return { ok: false, error: "The master account can't be removed." };
  if (me.id === id || !atLeast(me, "admin") || !canEdit(me, t)) return { ok: false, error: "You can't remove this person." };
  await sql`delete from members where id = ${id}`;
  revalidatePath("/team");
  return { ok: true };
}

/** Real photo for a person (used everywhere except the Home overview). Data URL resized in the browser. */
export async function setPhoto(id: string, dataUrl: string | null): Promise<R> {
  const me = await requireMember();
  const t = await target(id);
  if (!t || !canEdit(me, t)) return { ok: false, error: "You can't change this photo." };
  if (dataUrl !== null) {
    if (!/^data:image\/(png|jpeg|webp);base64,/.test(dataUrl)) return { ok: false, error: "Use a PNG, JPG or WebP." };
    if (dataUrl.length > 600_000) return { ok: false, error: "That photo is too big." };
  }
  await sql`update members set photo = ${dataUrl} where id = ${id}`;
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setTheme(theme: "light" | "dark") {
  const me = await requireMember();
  if (!["light", "dark"].includes(theme)) return;
  await sql`update members set theme = ${theme} where id = ${me.id}`;
  revalidatePath("/", "layout");
}
