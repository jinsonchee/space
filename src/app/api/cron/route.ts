import { NextResponse } from "next/server";
import { sql, getSettings } from "@/lib/db";
import { notify } from "@/lib/notify";
import { todayIn, localHourAndDay, mondayOf, addDays } from "@/lib/dates";
import { syncYouTube } from "@/lib/youtube";
import { syncInstagram } from "@/lib/instagram";
import { syncTikTok } from "@/lib/tiktok";

export const dynamic = "force-dynamic";

/**
 * Scheduled reminders. Called by the host's cron (see vercel.json) — it works out what's due
 * from the artist's local time, so it's safe to call any number of times (everything is de-duplicated).
 *  - Sunday evening: "plan next week" prompt (+ email)
 *  - Monday morning: weekly overview (+ email)
 *  - Every morning: tasks due today / overdue (in-app)
 *  - Every run: refresh YouTube channel numbers (if linked)
 *  - Every run: Instagram and TikTok followers + posts (if connected)
 * On-hold tasks are paused on purpose: no due/overdue nudges, just a count on Monday.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const url = new URL(req.url);
  if (!secret || (auth !== `Bearer ${secret}` && url.searchParams.get("key") !== secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const s = await getSettings();
  if (!s) return NextResponse.json({ ok: true, skipped: "not set up" });

  const force = url.searchParams.get("force"); // for testing: sunday | monday | daily
  const today = todayIn(s.timezone);
  const { hour, weekday } = localHourAndDay(s.timezone);
  const monday = mondayOf(today);
  const members = await sql<{ id: string; name: string }[]>`select id, name from members`;
  const done: string[] = [];

  // ---- Sunday evening: renew your week ----
  if (force === "sunday" || (weekday === "Sun" && hour >= 16)) {
    const nextMonday = addDays(monday, 7);
    for (const m of members) {
      const [{ total, left, planned }] = await sql<{ total: number; left: number; planned: number }[]>`
        select
          (select count(*)::int from todos where member_id = ${m.id} and scope = 'week' and on_date = ${monday}) as total,
          (select count(*)::int from todos where member_id = ${m.id} and scope = 'week' and on_date = ${monday} and not done) as left,
          (select count(*)::int from todos where member_id = ${m.id} and scope = 'week' and on_date = ${nextMonday}) as planned`;
      if (planned > 0) continue;
      await notify({
        memberId: m.id,
        kind: "sunday",
        title: "Sunday reset time ✨",
        body: left
          ? `You've got ${left} goal${left === 1 ? "" : "s"} left from this week. Roll them over and plan next week's wins.`
          : total
            ? "Clean sweep this week! Set a few goals for next week while you're feeling it."
            : "New week, new wins. Take 2 minutes to set a few goals for next week.",
        link: "/week",
        dedupeKey: `sunday:${nextMonday}`,
        email: true,
      });
    }
    done.push("sunday");
  }

  // ---- Monday morning: weekly overview ----
  if (force === "monday" || (weekday === "Mon" && hour < 13)) {
    const sunday = addDays(monday, 6);
    for (const m of members) {
      const [o] = await sql<{ goals: number; due: number; overdue: number; doing: number; hold: number }[]>`
        select
          (select count(*)::int from todos where member_id = ${m.id} and scope = 'week' and on_date = ${monday}) as goals,
          (select count(*)::int from tasks t join task_assignees a on a.task_id = t.id where a.member_id = ${m.id} and t.status not in ('done', 'hold') and t.due_date between ${monday} and ${sunday}) as due,
          (select count(*)::int from tasks t join task_assignees a on a.task_id = t.id where a.member_id = ${m.id} and t.status not in ('done', 'hold') and t.due_date < ${monday}) as overdue,
          (select count(*)::int from tasks t join task_assignees a on a.task_id = t.id where a.member_id = ${m.id} and t.status = 'doing') as doing,
          (select count(*)::int from tasks t join task_assignees a on a.task_id = t.id where a.member_id = ${m.id} and t.status = 'hold') as hold`;
      const lines = [
        `• ${o.due} task${o.due === 1 ? "" : "s"} due this week`,
        o.overdue ? `• ${o.overdue} overdue — let's clear ${o.overdue === 1 ? "it" : "them"} first` : null,
        o.doing ? `• ${o.doing} in progress` : null,
        o.hold ? `• ${o.hold} task${o.hold === 1 ? "" : "s"} on hold` : null,
        `• ${o.goals} weekly goal${o.goals === 1 ? "" : "s"} set${o.goals === 0 ? " (add some!)" : ""}`,
      ].filter(Boolean);
      await notify({
        memberId: m.id,
        kind: "monday",
        title: `Happy Monday, ${m.name.split(" ")[0]}! Here's your week 🎤`,
        body: lines.join("\n"),
        link: "/week",
        dedupeKey: `monday:${monday}`,
        email: true,
      });
    }
    done.push("monday");
  }

  // ---- Every morning: due today / overdue ----
  if (force === "daily" || hour < 13) {
    const rows = await sql<{ member_id: string; id: string; title: string; due: string }[]>`
      select a.member_id, t.id, t.title, to_char(t.due_date, 'YYYY-MM-DD') as due
      from tasks t join task_assignees a on a.task_id = t.id
      where t.status not in ('done', 'hold') and t.due_date <= ${today}`;
    for (const r of rows) {
      await notify({
        memberId: r.member_id,
        kind: "due",
        title: r.due === today ? "Due today ⏰" : "Overdue task 👀",
        body: `“${r.title}”`,
        link: `/tasks?open=${r.id}`,
        dedupeKey: `due:${r.id}:${today}`,
      });
    }
    done.push("daily");
  }

  const youtube = await syncYouTube().catch(() => "error");
  const instagram = await syncInstagram().catch(() => "error");
  const tiktok = await syncTikTok().catch(() => "error");
  return NextResponse.json({ ok: true, ran: done, youtube, instagram, tiktok, local: { today, hour, weekday } });
}
