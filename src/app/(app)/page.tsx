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
import { when } from "@/lib/when";
import StatsEditor from "./StatsEditor";
import GoalEditor from "./GoalEditor";

const PACE: Record<GoalProgress["pace"], { label: string; cls: string }> = {
  ahead: { label: "Ahead of pace", cls: "pace-ahead" },
  "on-track": { label: "On track", cls: "pace-ok" },
  behind: { label: "Behind pace", cls: "pace-behind" },
  done: { label: "Goal smashed", cls: "pace-ahead" },
};

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
  const [people, latest, past, myTasks, labels, todos, goals, streak] = await Promise.all([
    sql<{ id: string; name: string; role_label: string; avatar: AvatarConfig; access: string }[]>`
      select id, name, role_label, avatar, access from members order by case access when 'master' then 0 else 1 end, created_at`,
    sql<{ platform: string; value: string }[]>`select distinct on (platform) platform, value from stats_snapshots order by platform, captured_on desc`,
    sql<{ platform: string; value: string }[]>`
      select distinct on (platform) platform, value from stats_snapshots where captured_on <= ${monthAgo} order by platform, captured_on desc`,
    getTasks({ assignee: me.id, openOnly: true }),
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
  const nextGoalTask = main ? myTasks.find((t) => t.goal_id === main.id) : undefined;

  return (
    <>
      <div className="page-head">
        <div>
          <p className="muted small" style={{ fontWeight: 600 }}>{prettyDay(today)}</p>
          <h1 style={{ marginTop: 4 }}>{greet}, {me.name.split(" ")[0]}</h1>
        </div>
        {isAdmin && <StatsEditor current={now} />}
      </div>

      <div className="grid g-hero" style={{ marginBottom: 16 }}>
        <section className="stage">
          {artist && <Character config={artist.avatar} size={200} label={`${artist.name}'s character`} />}
          <div className="col" style={{ gap: 12, minWidth: 0 }}>
            {main ? (
              <>
                <div className="row wrap" style={{ gap: 8 }}>
                  <span className="eyebrow">{year} goal</span>
                  <span className={`chip ${PACE[main.pace].cls}`}>{PACE[main.pace].label}</span>
                  <span className="chip">{main.daysLeft} days left</span>
                </div>
                <h2 style={{ fontSize: 26 }}>{main.title}</h2>
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
                  <div><strong>{streak.streak} day{streak.streak === 1 ? "" : "s"}</strong><span>your streak{streak.doneToday ? "" : " · finish one thing today"}</span></div>
                  <div><strong>{main.weekDone}/{main.weekTotal}</strong><span>goal tasks this week</span></div>
                  <div className="hide-sm"><strong style={{ fontSize: 14 }}>{nextGoalTask ? nextGoalTask.title : "—"}</strong><span>your next goal task</span></div>
                </div>
              </>
            ) : (
              <>
                <span className="eyebrow">{year} goal</span>
                <h2 style={{ fontSize: 26 }}>What does a great {year} look like?</h2>
                <p className="muted small">Set a goal for the year — like a listener target or finishing the album — and link tasks to it. Progress here only moves when real work gets done.</p>
                {isAdmin ? <GoalEditor mode="new" today={today} /> : <p className="small faint">Ask the artist or an admin to set this year&apos;s goal.</p>}
              </>
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-title">
            <div>
              <span className="eyebrow">This week</span>
              <h2 style={{ marginTop: 4 }}>{week.filter((t) => t.done).length}/{week.length} goals</h2>
            </div>
            <div className="ring" style={{ ["--p" as string]: weekPct }}><span>{weekPct}%</span></div>
          </div>
          <div className="row between small" style={{ padding: "10px 0", borderTop: "1px solid var(--line)" }}>
            <span className="muted">Today&apos;s to-dos</span>
            <strong>{day.filter((t) => t.done).length} / {day.length}</strong>
          </div>
          <div className="row between small" style={{ padding: "10px 0", borderTop: "1px solid var(--line)" }}>
            <span className="muted">Open tasks for you</span>
            <strong>{myTasks.length}</strong>
          </div>
          <Link href="/week" className="btn" style={{ width: "100%", marginTop: 8 }}>Open My Week</Link>
        </section>
      </div>

      {(calState || mailCard) && (
        <div className={`grid ${calState && mailCard ? "g-2" : ""}`} style={{ marginBottom: 16, alignItems: "start" }}>
          {calState && <TodayCard cal={calState} events={todayEvents} />}
          {mailCard && <InboxCard r={mailCard} times={mailTimes} />}
        </div>
      )}

      {crew.length > 0 && (
        <section className="card crew" style={{ marginBottom: 16 }}>
          <div className="card-title">
            <h2>The crew</h2>
            <Link href="/team" className="btn btn-sm btn-ghost">Team <I.right style={{ width: 14 }} /></Link>
          </div>
          <div className="crew-row">
            {crew.map((c) => (
              <div key={c.id} className="crew-member">
                <Character config={c.avatar} size={120} showPet={false} label={`${c.name}'s character`} />
                <div style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</div>
                <div className="tiny muted">{c.role_label}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {goals.length > 0 && (
        <section className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">
            <h2>{year} goals</h2>
            {isAdmin && <GoalEditor mode="new" today={today} />}
          </div>
          <div className="col" style={{ gap: 14 }}>
            {goals.map((g) => (
              <div key={g.id} className="goal-row">
                <div className="row between wrap" style={{ gap: 8 }}>
                  <div className="row" style={{ gap: 8, minWidth: 0 }}>
                    {g.is_primary && <span className="chip chip-accent">Main</span>}
                    <strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.title}</strong>
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <span className={`chip ${PACE[g.pace].cls}`}>{PACE[g.pace].label}</span>
                    <span className="small" style={{ fontWeight: 700 }}>{Math.round(g.pct)}%</span>
                    {isAdmin && <GoalEditor mode="edit" today={today} goal={g} />}
                  </div>
                </div>
                <GoalBar g={g} />
                <div className="tiny muted">{goalDetail(g)} · {g.daysLeft} days left{g.kind === "metric" && g.tasksTotal ? ` · ${g.tasksDone}/${g.tasksTotal} goal tasks done` : ""}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">
          <h2>Across platforms</h2>
          <span className="tiny faint">Auto-sync arrives in Phase 2 · manual for now</span>
        </div>
        <div className="grid g-3">
          {PLATFORMS.map((p) => {
            const v = now[p.key];
            const t = then[p.key];
            const g = v !== undefined && t ? ((v - t) / t) * 100 : null;
            return (
              <div key={p.key} className="platform-tile card card-tight" style={{ background: "var(--surface-2)" }}>
                <div className="row between">
                  <span className="row" style={{ gap: 10 }}>
                    <span className="platform-badge" style={{ background: p.color, color: p.key === "tiktok" ? "#000" : "#fff" }}>{p.name[0]}</span>
                    <span style={{ fontWeight: 600 }}>{p.name}</span>
                  </span>
                  {g !== null && g !== 0 && <span className={g >= 0 ? "trend-up" : "trend-down"}>{g >= 0 ? "+" : ""}{g.toFixed(1)}%</span>}
                </div>
                <div className="stat">
                  <span className="stat-value">{v !== undefined ? compact(v) : "—"}</span>
                  <span className="tiny muted">{p.metric}{g !== null ? " · 30 days" : ""}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <h2>On your plate</h2>
          <Link href="/tasks" className="btn btn-sm btn-ghost">All tasks <I.right style={{ width: 14 }} /></Link>
        </div>
        {myTasks.length === 0 ? (
          <p className="muted small">Nothing assigned to you right now.</p>
        ) : (
          myTasks.slice(0, 6).map((t) => (
            <Link key={t.id} href={`/tasks?open=${t.id}`} className="task-row" style={{ gridTemplateColumns: "1fr auto" }}>
              <div style={{ minWidth: 0 }}>
                <div className="task-title">{t.title}</div>
                <div className="row wrap" style={{ gap: 6, marginTop: 4 }}>
                  <span className={`tag tag-${t.priority}`} title="Priority">{priorityLabel(t.priority)}</span>
                  {(t.status === "doing" || t.status === "hold") && <span className={`tag tag-${t.status}`}>{statusLabel(t.status)}</span>}
                  {t.goal_id && <span className="chip" style={{ color: "var(--accent)" }}>◎ Goal</span>}
                  {t.labels.map((l) => labelById[l] && <span key={l} className="chip"><span className="dot" style={{ background: labelById[l].color }} />{labelById[l].name}</span>)}
                </div>
              </div>
              {t.due_date && <span className={`small ${t.due_date < today ? "overdue" : "muted"}`}>{t.due_date < today ? "Overdue · " : ""}{t.due_date === today ? "Today" : shortDay(t.due_date)}</span>}
            </Link>
          ))
        )}
      </div>
    </>
  );
}
