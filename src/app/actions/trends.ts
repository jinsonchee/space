"use server";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireAccess } from "@/lib/auth";
import { syncTrends } from "@/lib/trends";

/** Artist/admins: refresh today's trends now (at most once an hour — searches use daily quota). */
export async function refreshTrends() {
  await requireAccess("admin");
  const [r] = await sql<{ fresh: boolean }[]>`select exists (select 1 from settings where id = 1 and trends_refreshed_at > now() - interval '1 hour') as fresh`;
  if (r?.fresh) return { ok: true as const, note: "Already refreshed in the last hour." };
  await sql`update settings set trends_refreshed_at = now() where id = 1`;
  const s = await syncTrends(true);
  revalidatePath("/trends");
  return s === "ok" ? { ok: true as const, note: "Updated ✓" } : { ok: false as const, error: s === "off" ? "YouTube isn't set up for this Space yet." : "YouTube didn't answer. Try again later." };
}
