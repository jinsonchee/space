"use server";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireAccess } from "@/lib/auth";
import { isHex } from "@/lib/color";

export async function updateSettings(data: { artist_name: string; accent: string; timezone: string }) {
  await requireAccess("master");
  const name = data.artist_name.trim().slice(0, 40);
  if (!name) return { ok: false as const, error: "Artist name can't be empty." };
  let tz = "Asia/Kuala_Lumpur";
  try { new Intl.DateTimeFormat("en", { timeZone: data.timezone }); tz = data.timezone; } catch {}
  await sql`update settings set artist_name = ${name}, accent = ${isHex(data.accent) ? data.accent : "#1ed760"}, timezone = ${tz} where id = 1`;
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** Stores the artist photo or logo as a small data URL (resized in the browser before upload). */
export async function setImage(kind: "photo" | "logo", dataUrl: string | null) {
  await requireAccess("master");
  if (dataUrl !== null) {
    if (!/^data:image\/(png|jpeg|webp|svg\+xml);base64,/.test(dataUrl)) return { ok: false as const, error: "Use a PNG, JPG, WebP or SVG." };
    if (dataUrl.length > 1_500_000) return { ok: false as const, error: "That image is too big — try one under 1 MB." };
  }
  if (kind === "photo") await sql`update settings set photo = ${dataUrl} where id = 1`;
  else await sql`update settings set logo = ${dataUrl} where id = 1`;
  revalidatePath("/", "layout");
  return { ok: true as const };
}
