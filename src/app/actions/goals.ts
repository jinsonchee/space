"use server";
import { revalidatePath } from "next/cache";
import { sql, transaction } from "@/lib/db";
import { requireAccess } from "@/lib/auth";
import { isIsoDate } from "@/lib/dates";
import { PLATFORMS } from "@/lib/levels";

const uuidRe = /^[0-9a-f-]{36}$/i;

export type GoalInput = {
  id?: string;
  title: string;
  kind: "milestones" | "metric";
  platform?: string | null;
  target_value?: number | null;
  end_date: string;
  is_primary?: boolean;
};

export async function saveGoal(g: GoalInput) {
  await requireAccess("admin");
  const title = g.title.trim().slice(0, 140);
  if (!title) return { ok: false as const, error: "Give the goal a name." };
  if (!isIsoDate(g.end_date)) return { ok: false as const, error: "Pick a finish date." };
  const kind = g.kind === "metric" ? "metric" : "milestones";
  let platform: string | null = null;
  let target: number | null = null;
  if (kind === "metric") {
    if (!PLATFORMS.some((p) => p.key === g.platform)) return { ok: false as const, error: "Choose which platform number to grow." };
    if (!g.target_value || g.target_value <= 0) return { ok: false as const, error: "Set a target number." };
    platform = g.platform!;
    target = Math.round(g.target_value);
  }
  const id = g.id && uuidRe.test(g.id) ? g.id : null;
  await transaction(async (tx) => {
    let goalId = id;
    if (goalId) {
      await tx`update goals set title = ${title}, kind = ${kind}, platform = ${platform}, target_value = ${target}, end_date = ${g.end_date} where id = ${goalId}`;
    } else {
      // metric goals start from today's number, so progress = growth you actually made
      const [cur] = platform ? await tx<{ value: string }[]>`select value from stats_snapshots where platform = ${platform} order by captured_on desc limit 1` : [];
      const [row] = await tx<{ id: string }[]>`
        insert into goals (title, kind, platform, start_value, target_value, end_date)
        values (${title}, ${kind}, ${platform}, ${cur ? Number(cur.value) : 0}, ${target}, ${g.end_date}) returning id`;
      goalId = row.id;
    }
    const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from goals where is_primary`;
    if (g.is_primary || n === 0) {
      await tx`update goals set is_primary = (id = ${goalId})`;
    }
  });
  revalidatePath("/");
  revalidatePath("/tasks");
  return { ok: true as const };
}

export async function deleteGoal(id: string) {
  await requireAccess("admin");
  if (!uuidRe.test(id)) return;
  await sql`delete from goals where id = ${id}`;
  // keep one primary goal if any remain
  await sql`update goals set is_primary = true where id = (select id from goals order by end_date limit 1) and not exists (select 1 from goals where is_primary)`;
  revalidatePath("/");
  revalidatePath("/tasks");
}
