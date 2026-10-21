"use client";
import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { addTodo, toggleTodo, deleteTodo, renewWeek, carryOver } from "../../actions/todos";
import { addDays, mondayOf, prettyDay, shortDay } from "@/lib/dates";
import { I } from "@/components/Icons";

import type { CalEvent } from "@/lib/google";
import { EventList } from "../TodayCard";
import { Toast } from "@/components/Toast";

export type Todo = { id: string; scope: "day" | "week"; on_date: string; text: string; done: boolean };

export default function WeekClient({ todos, today, day, monday, isWeekend, events, calExpired }: { todos: Todo[]; today: string; day: string; monday: string; isWeekend: boolean; events: Record<string, CalEvent[]> | null; calExpired: boolean }) {
  const [list, apply] = useOptimistic(todos, (state: Todo[], a: { type: "toggle" | "delete"; id: string } | { type: "add"; todo: Todo }) => {
    if (a.type === "add") return [...state, a.todo];
    if (a.type === "toggle") return state.map((t) => (t.id === a.id ? { ...t, done: !t.done } : t));
    return state.filter((t) => t.id !== a.id);
  });
  const [, start] = useTransition();
  const [flash, setFlash] = useState<string | null>(null);

  const weekly = list.filter((t) => t.scope === "week" && t.on_date === monday);
  const nextWeek = list.filter((t) => t.scope === "week" && t.on_date === addDays(monday, 7));
  const daily = list.filter((t) => t.scope === "day" && t.on_date === day);
  const yesterdayLeft = list.filter((t) => t.scope === "day" && t.on_date === addDays(day, -1) && !t.done);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const wDone = weekly.filter((t) => t.done).length;
  const wPct = weekly.length ? Math.round((wDone / weekly.length) * 100) : 0;

  const add = (scope: "day" | "week", text: string) => {
    const date = scope === "week" ? monday : day;
    start(async () => {
      apply({ type: "add", todo: { id: "tmp" + Math.random(), scope, on_date: date, text, done: false } });
      await addTodo(scope, date, text);
    });
  };
  const toggle = (id: string) => start(async () => { apply({ type: "toggle", id }); await toggleTodo(id); });
  const del = (id: string) => start(async () => { apply({ type: "delete", id }); await deleteTodo(id); });
  const say = (m: string) => { setFlash(m); setTimeout(() => setFlash(null), 2600); };

  const showRenew = monday === mondayOf(today) && isWeekend && nextWeek.length === 0;

  return (
    <>
      <Toast show={!!flash}>{flash}</Toast>
      <div className="page-head">
        <div>
          <h1>My Week</h1>
          <p className="muted">Week of {shortDay(monday)} – {shortDay(addDays(monday, 6))}</p>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <Link className="btn btn-sm btn-icon" href={`/week?d=${addDays(day, -7)}`} aria-label="Previous week"><I.left style={{ width: 16 }} /></Link>
          <Link className="btn btn-sm" href="/week">This week</Link>
          <Link className="btn btn-sm btn-icon" href={`/week?d=${addDays(day, 7)}`} aria-label="Next week"><I.right style={{ width: 16 }} /></Link>
        </div>
      </div>

      {showRenew && (
        <div className="card" style={{ marginBottom: 16, background: "var(--accent-soft)", borderColor: "transparent" }}>
          <div className="row between wrap" style={{ gap: 12 }}>
            <div>
              <h3>It&apos;s the weekend — time to plan next week ✨</h3>
              <p className="small muted" style={{ marginTop: 4 }}>Roll over the goals you didn&apos;t finish, then add fresh ones.</p>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-accent btn-sm" onClick={() => start(async () => { const n = await renewWeek(monday); say(n ? `Rolled ${n} goal${n === 1 ? "" : "s"} into next week` : "Nothing left to roll over — clean slate!"); })}>Renew my week</button>
              <Link href={`/week?d=${addDays(monday, 7)}`} className="btn btn-sm">Go to next week</Link>
            </div>
          </div>
        </div>
      )}

      <div className="grid g-hero" style={{ alignItems: "start" }}>
        <section className="card">
          <div className="card-title">
            <div>
              <span className="eyebrow">Today&apos;s list</span>
              <h2 style={{ marginTop: 4 }}>{day === today ? "Today" : prettyDay(day)}</h2>
            </div>
            {day === today && yesterdayLeft.length > 0 && (
              <button className="btn btn-sm" onClick={() => start(async () => { const n = await carryOver(addDays(day, -1), day); say(`Moved ${n} from yesterday`); })}>
                Bring {yesterdayLeft.length} from yesterday
              </button>
            )}
          </div>
          <div className="row" style={{ gap: 6, marginBottom: 14, overflowX: "auto", paddingBottom: 2 }}>
            {weekDays.map((d) => {
              const items = list.filter((t) => t.scope === "day" && t.on_date === d);
              const allDone = items.length > 0 && items.every((t) => t.done);
              const label = new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
              return (
                <Link key={d} href={`/week?d=${d}`} className="col" style={{
                  alignItems: "center", gap: 2, minWidth: 48, padding: "8px 0", borderRadius: 14,
                  background: d === day ? "var(--accent)" : "var(--surface-2)", color: d === day ? "var(--accent-ink)" : undefined,
                  border: d === today && d !== day ? "1.5px solid var(--accent)" : "1.5px solid transparent",
                }}>
                  <span className="tiny" style={{ fontWeight: 700, opacity: 0.8 }}>{label}</span>
                  <span className="head" style={{ fontSize: 17 }}>{Number(d.slice(8))}</span>
                  <span style={{ width: 6, height: 6, borderRadius: 2, background: items.length ? (allDone ? (d === day ? "var(--accent-ink)" : "var(--accent)") : "var(--faint)") : "transparent" }} />
                </Link>
              );
            })}
          </div>
          {events && (events[day]?.length ?? 0) > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div className="tiny muted" style={{ fontWeight: 700, marginBottom: 6 }}>🗓️ CALENDAR</div>
              <EventList events={events[day]} now={null} empty="" />
            </div>
          )}
          {calExpired && <p className="small" style={{ marginBottom: 12, color: "var(--warn)" }}>Your Google Calendar connection expired. <a href="/api/google/connect" style={{ textDecoration: "underline" }}>Reconnect</a></p>}
          <TodoList items={daily} onToggle={toggle} onDelete={del} empty="Nothing planned. Add the first thing below." />
          <AddRow placeholder="Add a to-do for this day…" onAdd={(t) => add("day", t)} />
        </section>

        <section className="card">
          <div className="card-title">
            <div>
              <span className="eyebrow">Weekly goals</span>
              <h2 style={{ marginTop: 4 }}>{wDone}/{weekly.length || 0} done</h2>
            </div>
            <div className="ring" style={{ ["--p" as string]: wPct }}><span>{wPct}%</span></div>
          </div>
          <TodoList items={weekly} onToggle={toggle} onDelete={del} empty="Set 3–5 goals for the week. Big wins only!" />
          <AddRow placeholder="Add a weekly goal…" onAdd={(t) => add("week", t)} />
          {!showRenew && weekly.some((t) => !t.done) && (
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={() => start(async () => { const n = await renewWeek(monday); say(n ? `Rolled ${n} goal${n === 1 ? "" : "s"} into next week` : "Already rolled over"); })}>
              Roll unfinished into next week →
            </button>
          )}
        </section>
      </div>
    </>
  );
}

function TodoList({ items, onToggle, onDelete, empty }: { items: Todo[]; onToggle: (id: string) => void; onDelete: (id: string) => void; empty: string }) {
  if (!items.length) return <p className="small muted" style={{ padding: "8px 0 14px" }}>{empty}</p>;
  return (
    <ul className="list-plain" style={{ marginBottom: 8 }}>
      {items.map((t) => (
        <li key={t.id} className="todo-item">
          <button className="check" role="checkbox" aria-checked={t.done} onClick={() => onToggle(t.id)} aria-label={t.done ? "Mark not done" : "Mark done"}>{t.done && <I.check />}</button>
          <span className={`grow ${t.done ? "todo-done" : ""}`}>{t.text}</span>
          <button className="btn btn-ghost btn-icon btn-sm del" onClick={() => onDelete(t.id)} aria-label="Delete"><I.trash style={{ width: 15 }} /></button>
        </li>
      ))}
    </ul>
  );
}

function AddRow({ placeholder, onAdd }: { placeholder: string; onAdd: (t: string) => void }) {
  const [v, setV] = useState("");
  return (
    <form className="row" style={{ gap: 8, marginTop: 6 }} onSubmit={(e) => { e.preventDefault(); if (v.trim()) { onAdd(v.trim()); setV(""); } }}>
      <input className="input" value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} />
      <button className="btn btn-accent btn-icon" aria-label="Add" disabled={!v.trim()}><I.plus style={{ width: 18 }} /></button>
    </form>
  );
}
