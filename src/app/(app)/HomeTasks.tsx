"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import type { TaskRow } from "@/lib/queries";
import { setTaskStatus } from "../actions/tasks";
import { shortDay } from "@/lib/dates";
import { I } from "@/components/Icons";

type Group = { key: string; label: string; tasks: TaskRow[] };

/** Home: her tasks grouped Overdue / Due today / Upcoming. Tick to finish right here; tick again to undo. */
export default function HomeTasks({ groups, today }: { groups: Group[]; today: string }) {
  const [done, setDone] = useState<Set<string>>(new Set());
  const [, start] = useTransition();
  const toggle = (id: string) => {
    const next = !done.has(id);
    setDone((d) => { const n = new Set(d); if (next) n.add(id); else n.delete(id); return n; });
    start(() => setTaskStatus(id, next ? "done" : "todo"));
  };
  const shown = groups.filter((g) => g.tasks.length);
  if (!shown.length) return <p className="muted small home-empty">Nothing assigned to you right now.</p>;
  return (
    <div className="col" style={{ gap: 18 }}>
      {shown.map((g) => (
        <div key={g.key}>
          <div className={`home-group ${g.key === "overdue" ? "overdue" : ""}`}>{g.label} <span>{g.tasks.length}</span></div>
          <ul className="home-tasks">
            {g.tasks.map((t) => {
              const isDone = done.has(t.id);
              return (
                <li key={t.id} className={isDone ? "is-done" : ""}>
                  <button className="tick" role="checkbox" aria-checked={isDone} aria-label={isDone ? `Mark "${t.title}" not done` : `Mark "${t.title}" done`} onClick={() => toggle(t.id)}>
                    <I.check />
                  </button>
                  <Link href={`/tasks?open=${t.id}`} className="home-task-link">
                    <span className="home-task-title">{t.title}</span>
                    <span className="home-task-meta">
                      {t.priority === "high" && <span className="home-urgent">Urgent</span>}
                      {t.due_date && <span className={t.due_date < today ? "overdue" : ""}>{t.due_date === today ? "Today" : shortDay(t.due_date)}</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
