"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TaskRow, MemberLite, Label, GoalLite } from "@/lib/queries";
import { setTaskStatus } from "../../actions/tasks";
import { I } from "@/components/Icons";
import { Photo } from "@/components/Photo";
import { TaskModal } from "./TaskModal";
import { ImportClickUp } from "./ImportClickUp";
import { shortDay, addDays, mondayOf } from "@/lib/dates";
import { STATUSES, priorityLabel, statusLabel } from "@/lib/task-meta";

type View = "list" | "board" | "calendar";
type Who = "all" | "mine" | "created";
const COLS = STATUSES;

export default function TasksClient({ tasks, members, labels, goals, meId, isAdmin, today, openId }: { tasks: TaskRow[]; members: MemberLite[]; labels: Label[]; goals: GoalLite[]; meId: string; isAdmin: boolean; today: string; openId: string | null }) {
  const router = useRouter();
  const [view, setView] = useState<View>("list");
  const [who, setWho] = useState<Who>("all");
  const [label, setLabel] = useState<string | null>(null);
  const [editing, setEditing] = useState<TaskRow | "new" | null>(null);
  const [, start] = useTransition();
  const [optimistic, setOptimistic] = useState<Record<string, TaskRow["status"]>>({});

  useEffect(() => {
    try { const v = localStorage.getItem("space_task_view") as View | null; if (v) setView(v); } catch {}
  }, []);
  useEffect(() => { try { localStorage.setItem("space_task_view", view); } catch {} }, [view]);
  useEffect(() => {
    if (openId) {
      const t = tasks.find((x) => x.id === openId);
      if (t) setEditing(t);
    }
  }, [openId, tasks]);

  const byId = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members]);
  const labelById = useMemo(() => Object.fromEntries(labels.map((l) => [l.id, l])), [labels]);
  const list = useMemo(
    () =>
      tasks
        .map((t) => (optimistic[t.id] ? { ...t, status: optimistic[t.id] } : t))
        .filter((t) => (who === "mine" ? t.assignees.includes(meId) : who === "created" ? t.created_by === meId : true))
        .filter((t) => (label ? t.labels.includes(label) : true)),
    [tasks, optimistic, who, label, meId],
  );

  const move = (id: string, status: TaskRow["status"]) => {
    setOptimistic((o) => ({ ...o, [id]: status }));
    start(async () => { await setTaskStatus(id, status); router.refresh(); });
  };

  const openCount = list.filter((t) => t.status !== "done").length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Tasks</h1>
          <p className="muted">{openCount} open {openCount === 1 ? "task" : "tasks"} for the team</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {isAdmin && <ImportClickUp />}
          <button className="btn btn-accent" onClick={() => setEditing("new")}><I.plus style={{ width: 18, height: 18 }} /> New task</button>
        </div>
      </div>

      <div className="row wrap between" style={{ marginBottom: 18, gap: 12 }}>
        <div className="seg" role="group" aria-label="View">
          {(["list", "board", "calendar"] as View[]).map((v) => {
            const Icon = v === "list" ? I.list : v === "board" ? I.board : I.calendar;
            return (
              <button key={v} aria-pressed={view === v} onClick={() => setView(v)} className="row" style={{ gap: 6, display: "inline-flex", alignItems: "center" }}>
                <Icon style={{ width: 15, height: 15 }} /> <span className="hide-sm">{v[0].toUpperCase() + v.slice(1)}</span>
              </button>
            );
          })}
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          <div className="seg" role="group" aria-label="Filter">
            {([["all", "Everyone"], ["mine", "Mine"], ["created", "I made"]] as [Who, string][]).map(([k, l]) => (
              <button key={k} aria-pressed={who === k} onClick={() => setWho(k)}>{l}</button>
            ))}
          </div>
          <select className="select" style={{ width: "auto", height: 40, borderRadius: 999 }} value={label ?? ""} onChange={(e) => setLabel(e.target.value || null)} aria-label="Label filter">
            <option value="">All labels</option>
            {labels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
      </div>

      {list.length === 0 && (
        <div className="empty">
          <p style={{ fontWeight: 600, color: "var(--text)" }}>No tasks here yet</p>
          <p className="small" style={{ marginTop: 4 }}>Create one and assign it to someone on the team.</p>
        </div>
      )}

      {list.length > 0 && view === "list" && (
        <div className="col" style={{ gap: 22 }}>
          {COLS.map((c) => {
            const items = list.filter((t) => t.status === c.key);
            if (!items.length) return null;
            return (
              <section key={c.key}>
                <div className="row" style={{ gap: 8, marginBottom: 10 }}><span className={`tag tag-${c.key}`}>{c.label}</span><span className="small muted">{items.length}</span></div>
                {items.map((t) => (
                  <TaskLine key={t.id} t={t} today={today} byId={byId} labelById={labelById} onOpen={() => setEditing(t)} onToggle={() => move(t.id, t.status === "done" ? "todo" : "done")} />
                ))}
              </section>
            );
          })}
        </div>
      )}

      {list.length > 0 && view === "board" && <Board list={list} today={today} byId={byId} labelById={labelById} onOpen={setEditing} onMove={move} />}

      {view === "calendar" && <Calendar list={list} today={today} onOpen={setEditing} labelById={labelById} />}

      {editing && (
        <TaskModal
          task={editing === "new" ? null : editing}
          members={members}
          labels={labels}
          goals={goals}
          meId={meId}
          onClose={() => { setEditing(null); if (openId) router.replace("/tasks"); }}
        />
      )}
    </>
  );
}

function Due({ d, today, done }: { d: string | null; today: string; done: boolean }) {
  if (!d) return null;
  const late = !done && d < today;
  const label = d === today ? "Today" : d === addDays(today, 1) ? "Tomorrow" : shortDay(d);
  return <span className={`small ${late ? "overdue" : "muted"}`}>{late ? "Overdue · " : ""}{label}</span>;
}

function Assignees({ ids, byId }: { ids: string[]; byId: Record<string, MemberLite> }) {
  if (!ids.length) return null;
  return (
    <span className="avatar-stack" title={ids.map((i) => byId[i]?.name).join(", ")}>
      {ids.slice(0, 3).map((i) => byId[i] && <Photo key={i} src={byId[i].photo} name={byId[i].name} size={26} />)}
      {ids.length > 3 && <span className="chip" style={{ marginLeft: 4 }}>+{ids.length - 3}</span>}
    </span>
  );
}

function Labels({ ids, labelById }: { ids: string[]; labelById: Record<string, Label> }) {
  return (
    <>
      {ids.map((l) => labelById[l] && (
        <span key={l} className="chip"><span className="dot" style={{ background: labelById[l].color }} />{labelById[l].name}</span>
      ))}
    </>
  );
}

function TaskLine({ t, today, byId, labelById, onOpen, onToggle }: { t: TaskRow; today: string; byId: Record<string, MemberLite>; labelById: Record<string, Label>; onOpen: () => void; onToggle: () => void }) {
  const done = t.status === "done";
  return (
    <div className={`task-row ${done ? "task-done" : ""}`} onClick={onOpen}>
      <button className="check" role="checkbox" aria-checked={done} aria-label={done ? "Mark not done" : "Mark done"} onClick={(e) => { e.stopPropagation(); onToggle(); }}>
        {done && <I.check />}
      </button>
      <div style={{ minWidth: 0 }}>
        <div className="row" style={{ gap: 8 }}>
          <span className="task-title" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
        </div>
        <div className="row wrap" style={{ gap: 6, marginTop: 4 }}>
          {!done && <span className={`tag tag-${t.priority}`} title="Priority">{priorityLabel(t.priority)}</span>}
          {(t.status === "doing" || t.status === "hold") && <span className={`tag tag-${t.status}`}>{statusLabel(t.status)}</span>}
          {t.goal_id && <span className="chip" title="Counts toward a yearly goal" style={{ color: "var(--accent)" }}>◎ Goal</span>}
          <Labels ids={t.labels} labelById={labelById} />
          <Due d={t.due_date} today={today} done={done} />
        </div>
      </div>
      <Assignees ids={t.assignees} byId={byId} />
    </div>
  );
}

function Board({ list, today, byId, labelById, onOpen, onMove }: { list: TaskRow[]; today: string; byId: Record<string, MemberLite>; labelById: Record<string, Label>; onOpen: (t: TaskRow) => void; onMove: (id: string, s: TaskRow["status"]) => void }) {
  const [over, setOver] = useState<string | null>(null);
  return (
    <div className="board">
      {COLS.map((c) => {
        const items = list.filter((t) => t.status === c.key);
        return (
          <div
            key={c.key}
            className={`board-col ${over === c.key ? "drop" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setOver(c.key); }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData("text/plain"); if (id) onMove(id, c.key); }}
          >
            <div className="row between" style={{ padding: "2px 4px 12px" }}>
              <span className={`tag tag-${c.key}`}>{c.label}</span>
              <span className="chip">{items.length}</span>
            </div>
            {items.map((t) => (
              <div key={t.id} className="board-card" draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)} onClick={() => onOpen(t)}>
                <div className="task-title" style={{ fontSize: 14 }}>{t.title}</div>
                <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>
                  {t.status !== "done" && <span className={`tag tag-${t.priority}`} title="Priority">{priorityLabel(t.priority)}</span>}
                  <Labels ids={t.labels} labelById={labelById} />
                </div>
                <div className="row between" style={{ marginTop: 10 }}>
                  <Due d={t.due_date} today={today} done={t.status === "done"} />
                  <Assignees ids={t.assignees} byId={byId} />
                </div>
                <select
                  className="select only-sm" style={{ marginTop: 10, height: 34, padding: "4px 8px" }}
                  value={t.status} onClick={(e) => e.stopPropagation()} onChange={(e) => onMove(t.id, e.target.value as TaskRow["status"])} aria-label="Move to"
                >
                  {COLS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function Calendar({ list, today, onOpen, labelById }: { list: TaskRow[]; today: string; onOpen: (t: TaskRow) => void; labelById: Record<string, Label> }) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const first = `${month}-01`;
  const start = mondayOf(first);
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const shift = (n: number) => {
    const d = new Date(first + "T00:00:00Z");
    d.setUTCMonth(d.getUTCMonth() + n);
    setMonth(d.toISOString().slice(0, 7));
  };
  const title = new Date(first + "T00:00:00Z").toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  const noDate = list.filter((t) => !t.due_date && t.status !== "done").length;
  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="row between" style={{ marginBottom: 12 }}>
        <h2>{title}</h2>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn btn-sm" onClick={() => setMonth(today.slice(0, 7))}>Today</button>
          <button className="btn btn-sm btn-icon" onClick={() => shift(-1)} aria-label="Previous month"><I.left style={{ width: 16 }} /></button>
          <button className="btn btn-sm btn-icon" onClick={() => shift(1)} aria-label="Next month"><I.right style={{ width: 16 }} /></button>
        </div>
      </div>
      <div className="cal" style={{ marginBottom: 6 }}>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="cal-head">{d}</div>)}
      </div>
      <div className="cal">
        {days.map((d) => {
          const items = list.filter((t) => t.due_date === d);
          return (
            <div key={d} className={`cal-cell ${d.slice(0, 7) !== month ? "out" : ""} ${d === today ? "today" : ""}`}>
              <span className="cal-num">{Number(d.slice(8))}</span>
              {items.slice(0, 3).map((t) => {
                const c = t.labels[0] ? labelById[t.labels[0]]?.color : undefined;
                return (
                  <span key={t.id} className="cal-task" onClick={() => onOpen(t)} title={t.title}
                    style={{ ...(c ? { background: `color-mix(in srgb, ${c} 22%, transparent)` } : {}), ...(t.status === "done" ? { textDecoration: "line-through", opacity: 0.6 } : {}) }}>
                    {t.title}
                  </span>
                );
              })}
              {items.length > 3 && <span className="tiny muted">+{items.length - 3} more</span>}
            </div>
          );
        })}
      </div>
      {noDate > 0 && <p className="small muted" style={{ marginTop: 12 }}>{noDate} open {noDate === 1 ? "task has" : "tasks have"} no due date — switch to List to see {noDate === 1 ? "it" : "them"}.</p>}
    </div>
  );
}
