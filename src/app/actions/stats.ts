"use server";
import { revalidatePath } from "next/cache";
import { sql, getSettings } from "@/lib/db";
import { requireAccess } from "@/lib/auth";
import { PLATFORMS } from "@/lib/levels";
import { todayIn } from "@/lib/dates";

/** Manual stats entry (Phase 1). Phase 2 fills the same table automatically from the platform APIs. */
export async function saveStats(values: Record<string, number | null>) {
  await requireAccess("admin");
  const s = await getSettings();
  const today = todayIn(s!.timezone);
  for (const p of PLATFORMS) {
    const v = values[p.key];
    if (v === null || v === undefined || !Number.isFinite(v) || v < 0) continue;
    await sql`
      insert into stats_snapshots (platform, value, captured_on, source) values (${p.key}, ${Math.round(v)}, ${today}, 'manual')
      on conflict (platform, captured_on) do update set value = excluded.value, source = 'manual'`;
  }
  revalidatePath("/");
  return { ok: true };
}
