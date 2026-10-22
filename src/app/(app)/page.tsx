import Link from "next/link";
import { requireMember, atLeast } from "@/lib/auth";
import { sql, getSettings, type AvatarConfig } from "@/lib/db";
import { getTasks, getLabels } from "@/lib/queries";
import { todayIn, addDays, mondayOf, localHourAndDay, prettyDay, shortDay } from "@/lib/dates";
import { PLATFORMS, compact } from "@/lib/levels";
import { goalsWithProgress, streakFor, type GoalProgress } from "@/lib/goals";
import { Character } from "@/components/Pixel";
import { I } from "@/components/Icons";
import { priorityLabel, statusLabel } from "@/lib/task-meta";
import { calendarConfigured, eventsBetween, eventsOn } from "@/lib/google";
import TodayCard from "./TodayCard";
import InboxCard from "./InboxCard";
import { listInbox } from "@/lib/gmail";
import { getYouTube } from "@/lib/youtube";
import { getInstagram } from "@/lib/instagram";
import { getTikTok } from "@/lib/tiktok";
import { when } from "@/lib/when";
import StatsEditor from "./StatsEditor";
import GoalEditor from "./GoalEditor";
import NudgeButton from "./NudgeButton";
import HomeTasks from "./HomeTasks";

const PACE_CLS: Record<GoalProgress["pace"], string> = { ahead: "pace-ahead", "on-track": "pace-ok", behind: "pace-behind", done: "pace-ahead" };

/** Pace in time, not labels: "3 weeks behind", "2 weeks ahead", "On pace". */
function paceText(g: GoalProgress) {
  if (g.pace === "done") return "Goal smashed";
  const total = (Date.parse(g.end_date) - Date.parse(g.start_date)) / 86400000;
  const off = ((g.pct - g.expected) / 100) * total; // days
  const d = Math.abs(off);
  if (d < 4) return "On pace";
  const amount = d < 10 ? `${Math.round(d)} days` : d < 60 ? `${Math.round(d / 7)} weeks` : `${Math.round(d / 30)} months`;
  return `${amount} ${off < 0 ? "behind" : "ahead"}`;
}
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

function goalDetail(g: GoalProgress) {
  if (g.kind === "metric") {
    const p = PLATFORMS.find((x) => x.key === g.platform);
    return `${compact(g.current ?? 0)} of ${compact(g.target_value ?? 0)} ${p?.name ?? ""} ${p?.metric ?? ""}`.trim();
  }
  return `${g.tasksDone} of ${g.tasksTotal} goal tasks done`;
}

function GoalBar({ g, big = false }: { g: GoalProgress; big?: boolean }) {
  return (
    <div className={`goal-bar ${big ? "goal-bar-big" : ""}`} aria-label={`${Math.round(g.pct)}% complete, expected ${Math.round(g.expected)}% by today`}>
      <span className="goal-fill" style={{ width: `${Math.max(g.pct, 1.5)}%` }} />
      {g.pace !== "done" && <span className="goal-pace" style={{ left: `${g.expected}%` }} title="Where you'd be today at an even pace" />}
    </div>
  );
}

export default async function Home() {
  const me = await requireMember();
  const s = (await getSettings())!;
  const today = todayIn(s.timezone);
  const monthAgo = addDays(today, -30);
  const year = today.slice(0, 4);

  const calendar = eventsBetween(me.id, today, today, s.timezone);
  const inbox = listInbox(me.id, { unreadOnly: true, max: 3 });
  const youtube = getYouTube();
  const instagram = getInstagram();
  const tiktok = getTikTok();
  const [people, latest, past, openTasks, labels, todos, goals, streak] = await Promise.all([
    sql<{ id: string; name: string; role_label: string; avatar: AvatarConfig; access: string }[]>`
      select id, name, role_label, avatar, access from members order by case access when 'master' then 0 else 1 end, created_at`,
    sql<{ platform: string; value: string }[]>`select distinct on (platform) platform, value from stats_snapshots order by platform, captured_on desc`,
    sql<{ platform: string; value: string }[]>`
      select distinct on (platform) platform, value from stats_snapshots where captured_on <= ${monthAgo} order by platform, captured_on desc`,
    getTasks({ openOnly: true }),
    getLabels(),
    sql<{ scope: string; done: boolean }[]>`
      select scope, done from todos
      where member_id = ${me.id} and ((scope = 'week' and on_date = ${mondayOf(today)}) or (scope = 'day' and on_date = ${today}))`,
    goalsWithProgress(today),
    streakFor(me.id, today, s.timezone),
  ]);

  const cal = await calendar;
  const todayEvents = cal.state === "ok" ? eventsOn(cal.events, today, s.timezone) : [];
  const calState = cal.state === "off" ? (calendarConfigured() ? "connect" : null) : cal.state;
  const mail = await inbox;
  const auto = new Set([...((await youtube).channel ? ["youtube"] : []), ...((await instagram)?.status === "ok" ? ["instagram"] : []), ...((await tiktok)?.status === "ok" ? ["tiktok"] : [])]);
  const mailCard = mail.state === "off" ? (calendarConfigured() ? { state: "connect" as const } : null) : mail;
  const mailTimes = mail.state === "ok" ? Object.fromEntries(mail.threads.map((t) => [t.id, when(t.date, s.timezone)])) : {};
  const now = Object.fromEntries(latest.map((r) => [r.platform, Number(r.value)]));
  const then = Object.fromEntries(past.map((r) => [r.platform, Number(r.value)]));
  const { hour } = localHourAndDay(s.timezone);
  const greet = hour < 5 ? "Late night grind" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const artist = people.find((p) => p.access === "master");
  const crew = people.filter((p) => p.access !== "master");
  const week = todos.filter((t) => t.scope === "week");
  const day = todos.filter((t) => t.scope === "day");
  const weekPct = week.length ? Math.round((week.filter((t) => t.done).length / week.length) * 100) : 0;
  const labelById = Object.fromEntries(labels.map((l) => [l.id, l]));
  const main = goals[0];
  const isAdmin = atLeast(me, "admin");
  const myTasks = openTasks.filter((t) => t.assignees.includes(me.id));
  const nextGoalTask = main ? myTasks.find((t) => t.goal_id === main.id) : undefined;
  const others = goals.filter((g) => g !== main);

  // Team status: what each person has on, split by status, and whether anything has slipped. (Tasks come sorted by due date.)
  const team = crew.map((c) => {
    const theirs = openTasks.filter((t) => t.assignees.includes(c.id));
    const by = (st: string) => theirs.filter((t) => t.status === st).length;
    return { ...c, open: theirs.length, todo: by("todo"), doing: by("doing"), hold: by("hold"), overdue: theirs.filter((t) => t.due_date && t.due_date < today).length, next: theirs[0] };
  });
  const teamOverdue = team.reduce((n, c) => n + c.overdue, 0);

  // Her tasks, grouped like a to-do app.
  const overdue = myTasks.filter((t) => t.due_date && t.due_date < today);
  const dueToday = myTasks.filter((t) => t.due_date === today);
  const upcoming = myTasks.filter((t) => !t.due_date || t.due_date > today).slice(0, 4);
  // The one thing that needs her first.
  const focus = overdue[0] ?? dueToday.find((t) => t.priority === "high") ?? dueToday[0];

  // One line under the greeting: the day at a glance.
  const glance = [
    cal.state === "ok" ? (todayEvents.length ? `${todayEvents.length} event${todayEvents.length === 1 ? "" : "s"}` : "a clear calendar") : null,
    mail.state === "ok" ? (mail.threads.length ? `${mail.estimate > mail.threads.length ? `${mail.estimate}+` : mail.threads.length} unread email${mail.threads.length === 1 ? "" : "s"}` : "an empty inbox") : null,
    overdue.length + dueToday.length ? `${overdue.length + dueToday.length} task${overdue.length + dueToday.length === 1 ? "" : "s"} due` : null,
  ].filter(Boolean);
  const glanceLine = glance.length ? `You have ${glance.length > 1 ? `${glance.slice(0, -1).join(", ")} and ${glance[glance.length - 1]}` : glance[0]} today.` : "Here's your focus for today.";

  return (
    <>
      <div className="page-head home-head">
        <div>
          <p className="muted small" style={{ fontWeight: 600 }}>{prettyDay(today)}</p>
          <h1 style={{ marginTop: 4 }}>{greet}, {me.name.split(" ")[0]}</h1>
          <p className="muted" style={{ marginTop: 6 }}>{glanceLine}</p>
        </div>
        <div className="quick" aria-label="Add">
          <Link href="/tasks?open=new" className="btn btn-sm"><I.plus style={{ width: 15 }} /> Task</Link>
          <Link href="/week" className="btn btn-sm"><I.plus style={{ width: 15 }} /> To-do</Link>
          {mail.state === "ok" && <Link href="/inbox?compose=1" className="btn btn-sm"><I.plus style={{ width: 15 }} /> Email</Link>}
        </div>
      </div>

      <div className="home">
        <div className="home-main">
          {/* The one thing that needs her first */}
          {focus && (
            <Link href={`/tasks?open=${focus.id}`} className="focus">
              <span className="focus-label">{focus.due_date && focus.due_date < today ? "Overdue" : "Due today"}{focus.priority === "high" ? " · Urgent" : ""}</span>
              <span className="focus-title">{focus.title}</span>
              <span className="focus-meta">
                {focus.due_date && focus.due_date < today ? `${daysBetween(focus.due_date, today)} day${daysBetween(focus.due_date, today) === 1 ? "" : "s"} late` : "Finish it today"}
                <span className="focus-go">Open <I.right style={{ width: 14 }} /></span>
              </span>
            </Link>
          )}

          <section className="sec home-tasks-sec">
            <div className="sec-head">
              <h2>Your tasks {myTasks.length > 0 && <span className="sec-count">{myTasks.length} open</span>}</h2>
              <Link href="/tasks" className="sec-link">All tasks <I.right style={{ width: 14 }} /></Link>
            </div>
            <HomeTasks today={today} groups={[
              { key: "overdue", label: "Overdue", tasks: overdue },
              { key: "today", label: "Due today", tasks: dueToday },
              { key: "upcoming", label: "Upcoming", tasks: upcoming },
            ]} />
          </section>

          {mailCard && <div className="home-inbox"><InboxCard r={mailCard} times={mailTimes} /></div>}
        </div>

        <aside className="home-rail">
          {calState && <TodayCard cal={calState} events={todayEvents} />}
          <section className="sec home-week">
            <div className="sec-head">
              <h2>This week</h2>
              <Link href="/week" className="sec-link">My Week <I.right style={{ width: 14 }} /></Link>
            </div>
            <div className="row" style={{ gap: 14 }}>
              <div className="ring" style={{ ["--p" as string]: weekPct }}><span>{weekPct}%</span></div>
              <div className="col" style={{ gap: 2 }}>
                <span><strong>{week.filter((t) => t.done).length} of {week.length}</strong> <span className="muted">week goals</span></span>
                <span className="small muted">{day.filter((t) => t.done).length} of {day.length} to-dos today · {streak.streak}-day streak</span>
              </div>
            </div>
          </section>
        </aside>
      </div>

      {/* Team status */}
      {team.length > 0 && (
        <section className="sec home-team">
          <div className="sec-head">
            <h2>Team status {teamOverdue > 0 ? <span className="sec-count overdue">{teamOverdue} overdue</span> : <span className="sec-count">all on time</span>}</h2>
            <Link href="/team" className="sec-link">Team <I.right style={{ width: 14 }} /></Link>
          </div>
          <div className="grid g-2" style={{ gap: 10 }}>
            {team.map((c) => (
              <div key={c.id} className="team-card">
                <div className="team-char"><Character config={c.avatar} size={64} showPet={false} label={`${c.name}'s character`} /></div>
                <div className="grow">
                  <div className="row between" style={{ gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700 }}>{c.name}</div>
                      <div className="tiny muted">{c.role_label}</div>
                    </div>
                    {c.overdue > 0 && c.id !== me.id && <NudgeButton memberId={c.id} name={c.name.split(" ")[0]} />}
                  </div>
                  <div className="workbar" title={`${c.todo} to do · ${c.doing} in progress · ${c.hold} on hold`}>
                    {c.open === 0 ? <span style={{ flex: 1, background: "var(--surface-3)" }} /> : <>
                      <span style={{ flex: c.doing, background: "var(--tone-progress)" }} />
                      <span style={{ flex: c.todo, background: "var(--tone-queue)" }} />
                      <span style={{ flex: c.hold, background: "var(--tone-hold)" }} />
                    </>}
                  </div>
                  <div className="small" style={{ marginTop: 6 }}>
                    <strong>{c.open}</strong> open{c.doing > 0 && <span className="muted"> · {c.doing} in progress</span>}{c.overdue > 0 && <> · <span className="overdue">{c.overdue} overdue</span></>}
                  </div>
                  {c.next && <div className="tiny muted team-next">Next: {c.next.title}</div>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* The year's goal, with the character beside it */}
      <section className="stage" style={{ marginTop: 28 }}>
        {artist && <div className="stage-char"><Character config={artist.avatar} size={150} label={`${artist.name}'s character`} /></div>}
        {main ? (
          <>
            <div className="stage-head">
              <div className="row between" style={{ gap: 8, alignItems: "flex-start" }}>
                <div className="row wrap" style={{ gap: 8 }}>
                  <span className="eyebrow">{year} goal</span>
                  <span className={`chip ${PACE_CLS[main.pace]}`}>{paceText(main)}</span>
                  <span className="chip">{main.daysLeft} days left</span>
                </div>
                {isAdmin && <GoalEditor mode="edit" today={today} goal={main} />}
              </div>
              <h2 className="stage-title">{main.title}</h2>
            </div>
            <div className="stage-body">
              <div className="row" style={{ alignItems: "baseline", gap: 10 }}>
                <span className="level-num">{Math.round(main.pct)}<small style={{ marginLeft: 2 }}>%</small></span>
                <span className="small muted">{goalDetail(main)}</span>
              </div>
              <GoalBar g={main} big />
              <div className="row between tiny muted">
                <span>{shortDay(main.start_date)}</span>
                <span>▲ today&apos;s pace: {Math.round(main.expected)}%</span>
                <span>{shortDay(main.end_date)}</span>
              </div>
              <div className="hero-stats">
                <div><strong>{main.weekDone}/{main.weekTotal}</strong><span>goal tasks this week</span></div>
                <div style={{ gridColumn: "span 2" }}><strong style={{ fontSize: 14 }}>{nextGoalTask ? nextGoalTask.title : "—"}</strong><span>your next goal task</span></div>
              </div>
            </div>
          </>
        ) : (
          <div className="stage-head col" style={{ gap: 12, gridRow: "1 / span 2" }}>
            <span className="eyebrow">{year} goal</span>
            <h2 style={{ fontSize: 26 }}>What does a great {year} look like?</h2>
            <p className="muted small">Set a goal for the year — like a listener target or finishing the album — and link tasks to it. Progress here only moves when real work gets done.</p>
            {isAdmin ? <GoalEditor mode="new" today={today} /> : <p className="small faint">Ask the artist or an admin to set this year&apos;s goal.</p>}
          </div>
        )}
        {main && (others.length > 0 || isAdmin) && (
          <div className="stage-more">
            {others.map((g) => (
              <div key={g.id} className="goal-row">
                <div className="row between wrap" style={{ gap: 8 }}>
                  <strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{g.title}</strong>
                  <div className="row" style={{ gap: 8 }}>
                    <span className={`chip ${PACE_CLS[g.pace]}`}>{paceText(g)}</span>
                    <span className="small" style={{ fontWeight: 700 }}>{Math.round(g.pct)}%</span>
                    {isAdmin && <GoalEditor mode="edit" today={today} goal={g} />}
                  </div>
                </div>
                <GoalBar g={g} />
                <div className="tiny muted">{goalDetail(g)} · {g.daysLeft} days left</div>
              </div>
            ))}
            {isAdmin && <GoalEditor mode="new" today={today} />}
          </div>
        )}
      </section>

      {/* Numbers */}
      <section className="sec">
        <div className="sec-head">
          <h2>Across platforms</h2>
          <div className="row" style={{ gap: 6 }}>
            {isAdmin && <StatsEditor current={now} auto={[...auto]} />}
            <Link href="/socials" className="sec-link">Post Stats <I.right style={{ width: 14 }} /></Link>
          </div>
        </div>
        <div className="platforms">
          {PLATFORMS.map((p) => {
            const v = now[p.key];
            const t = then[p.key];
            const g = v !== undefined && t ? ((v - t) / t) * 100 : null;
            return (
              <div key={p.key} className="platform">
                <div className="row" style={{ gap: 8 }}>
                  <span className="platform-badge" style={{ background: p.color, color: p.key === "tiktok" ? "#000" : "#fff", width: 22, height: 22, borderRadius: 6, fontSize: 11 }}>{p.name[0]}</span>
                  <span className="small" style={{ fontWeight: 600 }}>{p.name}</span>
                </div>
                <div className="row" style={{ alignItems: "baseline", gap: 8, marginTop: 6 }}>
                  <span className="stat-value">{v !== undefined ? compact(v) : "—"}</span>
                  {g !== null && g !== 0 && <span className={g >= 0 ? "trend-up" : "trend-down"}>{g >= 0 ? "+" : ""}{g.toFixed(1)}%</span>}
                </div>
                <span className="tiny muted">{p.metric}{g !== null ? " · 30 days" : ""}{auto.has(p.key) ? " · auto" : ""}</span>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
