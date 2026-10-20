import "server-only";
import { sql } from "./db";
import { addDays, mondayOf } from "./dates";

export type Goal = {
  id: string;
  title: string;
  kind: "milestones" | "metric";
  platform: string | null;
  start_value: number | null;
  target_value: number | null;
  start_date: string;
  end_date: string;
  is_primary: boolean;
};

export type GoalProgress = Goal & {
  current: number | null; // metric goals
  tasksTotal: number;
  tasksDone: number;
  weekTotal: number; // goal tasks due this week
  weekDone: number;
  pct: number; // 0–100, real progress
  expected: number; // 0–100, where you "should" be today if progressing evenly
  daysLeft: number;
  pace: "ahead" | "on-track" | "behind" | "done";
};

const days = (a: string, b: string) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);

export async function goalsWithProgress(today: string): Promise<GoalProgress[]> {
  const monday = mondayOf(today);
  const sunday = addDays(monday, 6);
  const goals = await sql<(Goal & { tasks_total: number; tasks_done: number; week_total: number; week_done: number; current: string | null })[]>`
    select g.id, g.title, g.kind, g.platform, g.start_value::float8 as start_value, g.target_value::float8 as target_value,
      to_char(g.start_date, 'YYYY-MM-DD') as start_date, to_char(g.end_date, 'YYYY-MM-DD') as end_date, g.is_primary,
      (select count(*)::int from tasks t where t.goal_id = g.id) as tasks_total,
      (select count(*)::int from tasks t where t.goal_id = g.id and t.status = 'done') as tasks_done,
      (select count(*)::int from tasks t where t.goal_id = g.id and t.due_date between ${monday} and ${sunday}) as week_total,
      (select count(*)::int from tasks t where t.goal_id = g.id and t.due_date between ${monday} and ${sunday} and t.status = 'done') as week_done,
      (select s.value from stats_snapshots s where s.platform = g.platform order by s.captured_on desc limit 1) as current
    from goals g
    order by g.is_primary desc, g.end_date, g.created_at`;

  return goals.map((g) => {
    const current = g.current === null ? null : Number(g.current);
    let pct = 0;
    if (g.kind === "metric" && g.target_value !== null) {
      const start = g.start_value ?? 0;
      const span = g.target_value - start;
      pct = span > 0 && current !== null ? ((current - start) / span) * 100 : current !== null && current >= g.target_value ? 100 : 0;
    } else {
      pct = g.tasks_total ? (g.tasks_done / g.tasks_total) * 100 : 0;
    }
    pct = Math.max(0, Math.min(100, pct));
    const total = Math.max(1, days(g.start_date, g.end_date));
    const elapsed = Math.max(0, Math.min(total, days(g.start_date, today)));
    const expected = (elapsed / total) * 100;
    const daysLeft = Math.max(0, days(today, g.end_date));
    const pace = pct >= 100 ? "done" : pct >= expected + 5 ? "ahead" : pct >= expected - 5 ? "on-track" : "behind";
    return {
      id: g.id, title: g.title, kind: g.kind, platform: g.platform, start_value: g.start_value, target_value: g.target_value,
      start_date: g.start_date, end_date: g.end_date, is_primary: g.is_primary,
      current, tasksTotal: g.tasks_total, tasksDone: g.tasks_done, weekTotal: g.week_total, weekDone: g.week_done,
      pct, expected, daysLeft, pace,
    };
  });
}

/** Consecutive days (ending today, or yesterday if today isn't done yet) where this person finished something. */
export async function streakFor(memberId: string, today: string, tz: string) {
  const rows = await sql<{ d: string }[]>`
    select distinct to_char(on_date, 'YYYY-MM-DD') as d from todos
      where member_id = ${memberId} and done and scope = 'day' and on_date > ${addDays(today, -120)}
    union
    select distinct to_char((t.completed_at at time zone ${tz})::date, 'YYYY-MM-DD') as d
      from tasks t join task_assignees a on a.task_id = t.id
      where a.member_id = ${memberId} and t.completed_at is not null and t.completed_at > now() - interval '120 days'`;
  const set = new Set(rows.map((r) => r.d));
  let day = set.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (set.has(day)) { n++; day = addDays(day, -1); }
  return { streak: n, doneToday: set.has(today) };
}
