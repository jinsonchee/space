import { requireMember } from "@/lib/auth";
import { sql, getSettings } from "@/lib/db";
import { todayIn, mondayOf, addDays, isIsoDate, localHourAndDay } from "@/lib/dates";
import WeekClient, { type Todo } from "./WeekClient";

export default async function WeekPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const me = await requireMember();
  const s = (await getSettings())!;
  const today = todayIn(s.timezone);
  const sp = await searchParams;
  const day = isIsoDate(sp.d) ? sp.d : today;
  const monday = mondayOf(day);
  const sunday = addDays(monday, 6);
  const todos = await sql<Todo[]>`
    select id, scope, to_char(on_date, 'YYYY-MM-DD') as on_date, text, done from todos
    where member_id = ${me.id} and (
      (scope = 'week' and on_date in (${monday}, ${addDays(monday, 7)}))
      or (scope = 'day' and on_date between ${addDays(monday, -1)} and ${sunday})
    )
    order by created_at`;
  const { weekday } = localHourAndDay(s.timezone);
  return <WeekClient todos={todos} today={today} day={day} monday={monday} isWeekend={weekday === "Sat" || weekday === "Sun"} />;
}
