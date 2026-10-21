"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TaskRow, MemberLite, Label, GoalLite } from "@/lib/queries";
import { saveTask, deleteTask, nudgeTask, createLabel } from "../../actions/tasks";
import { Photo } from "@/components/Photo";
import { I } from "@/components/Icons";
import { STATUSES, PRIORITIES } from "@/lib/task-meta";
import { Sheet } from "@/components/Sheet";

const LABEL_COLORS = ["#8b5cf6", "#ff4fa3", "#ffb020", "#3b82f6", "#1ed760", "#22d3ee", "#ff6a3d"];

export function TaskModal({ task, draft, members, labels: initialLabels, goals, meId, onClose, onSaved }: { task: TaskRow | null; draft?: { title: string; description: string }; members: MemberLite[]; labels: Label[]; goals: GoalLite[]; meId: string; onClose: () => void; onSaved?: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState(task?.title ?? draft?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? draft?.description ?? "");
  const [status, setStatus] = useState<TaskRow["status"]>(task?.status ?? "todo");
  const [priority, setPriority] = useState<TaskRow["priority"]>(task?.priority ?? "normal");
  const [due, setDue] = useState(task?.due_date ?? "");
  const [assignees, setAssignees] = useState<string[]>(task?.assignees ?? []);
  const [labelIds, setLabelIds] = useState<string[]>(task?.labels ?? []);
  const [labels, setLabels] = useState(initialLabels);
  const [goalId, setGoalId] = useState<string>(task?.goal_id ?? "");
  const [newLabel, setNewLabel] = useState("");
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);

  // Ask before throwing away typed changes (an accidental click outside shouldn't lose work).
  const snapshot = JSON.stringify({ title, description, status, priority, due, assignees, labelIds, goalId });
  const initial = useRef(snapshot);
  const dirty = snapshot !== initial.current;
  const requestClose = () => (dirty ? setConfirmClose(true) : onClose());
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); if (confirmClose) setConfirmClose(false); else requestClose(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const toggle = (arr: string[], set: (v: string[]) => void, id: string) => set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  const save = () =>
    start(async () => {
      const r = await saveTask({ id: task?.id, title, description, status, priority, due_date: due || null, assignees, labels: labelIds, goal_id: goalId || null });
      if (!r.ok) return setMsg({ text: r.error, bad: true });
      router.refresh();
      onSaved?.();
      onClose();
    });

  const remove = () =>
    start(async () => {
      if (!task || !confirm("Delete this task?")) return;
      const r = await deleteTask(task.id);
      if (!r.ok) return setMsg({ text: r.error, bad: true });
      router.refresh();
      onClose();
    });

  const nudge = (channel: "app" | "both") =>
    start(async () => {
      if (!task) return;
      const r = await nudgeTask(task.id, channel);
      setMsg(r.ok ? { text: `Nudge sent to ${r.sent} ${r.sent === 1 ? "person" : "people"} ✨` } : { text: r.error, bad: true });
    });

  const addLabel = () =>
    start(async () => {
      const r = await createLabel(newLabel, LABEL_COLORS[labels.length % LABEL_COLORS.length]);
      if (r.ok) {
        setLabels((l) => (l.some((x) => x.id === r.label.id) ? l : [...l, r.label]));
        setLabelIds((x) => [...new Set([...x, r.label.id])]);
        setNewLabel("");
      }
    });

  const othersAssigned = (task?.assignees ?? []).some((a) => a !== meId);

  return (
    <>
      <Sheet open onClose={requestClose} closeOnEscape={false} label={task ? "Edit task" : "New task"}>
        <div className="row between" style={{ marginBottom: 16 }}>
          <span className="eyebrow">{task ? "Edit task" : "New task"}</span>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={requestClose} aria-label="Close"><I.x style={{ width: 16 }} /></button>
        </div>
        <div className="field">
          <label className="label" htmlFor="task-title">Task</label>
          <input id="task-title" className="input" style={{ fontSize: 17, fontWeight: 600 }} placeholder="What needs doing?" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus={!task} />
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label className="label" htmlFor="task-details">Details <span className="faint">(optional)</span></label>
          <textarea id="task-details" className="textarea" placeholder="Add details, links, references…" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="field" style={{ marginTop: 14 }}>
          <span className="label">Status</span>
          <div className="tag-pick" role="group" aria-label="Status">
            {STATUSES.map((o) => (
              <button key={o.key} type="button" className={`tag tag-${o.key}`} aria-pressed={status === o.key} onClick={() => setStatus(o.key)}>{o.label}</button>
            ))}
          </div>
        </div>
        <div className="grid g-2" style={{ gap: 10, marginTop: 14, alignItems: "end" }}>
          <div className="field">
            <span className="label">Priority</span>
            <div className="tag-pick" role="group" aria-label="Priority">
              {PRIORITIES.map((o) => (
                <button key={o.key} type="button" className={`tag tag-${o.key}`} aria-pressed={priority === o.key} onClick={() => setPriority(o.key)}>{o.label}</button>
              ))}
            </div>
          </div>
          <div className="field">
            <label className="label" htmlFor="task-due">Due date</label>
            <input id="task-due" className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
        </div>

        {goals.length > 0 && (
          <div className="field" style={{ marginTop: 14 }}>
            <label className="label">Counts toward a yearly goal</label>
            <select className="select" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
              <option value="">— Not linked —</option>
              {goals.map((g) => <option key={g.id} value={g.id}>◎ {g.title}</option>)}
            </select>
          </div>
        )}

        <div className="field" style={{ marginTop: 16 }}>
          <label className="label">Assign to</label>
          <div className="row wrap" style={{ gap: 8 }}>
            {members.map((m) => {
              const on = assignees.includes(m.id);
              return (
                <button key={m.id} type="button" className="btn btn-sm" onClick={() => toggle(assignees, setAssignees, m.id)}
                  style={on ? { background: "var(--accent-soft)", borderColor: "var(--accent)" } : { paddingLeft: 4 }}>
                  <Photo src={m.photo} name={m.name} size={22} />
                  {m.id === meId ? "Me" : m.name.split(" ")[0]}
                  {on && <I.check style={{ width: 14 }} />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="field" style={{ marginTop: 16 }}>
          <label className="label">Labels</label>
          <div className="row wrap" style={{ gap: 8 }}>
            {labels.map((l) => {
              const on = labelIds.includes(l.id);
              return (
                <button key={l.id} type="button" className="chip" onClick={() => toggle(labelIds, setLabelIds, l.id)}
                  style={{ cursor: "pointer", height: 30, ...(on ? { background: `color-mix(in srgb, ${l.color} 25%, transparent)`, color: "var(--text)", borderColor: l.color } : {}) }}>
                  <span className="dot" style={{ background: l.color }} />{l.name}
                </button>
              );
            })}
            <span className="row" style={{ gap: 4 }}>
              <input className="input" style={{ width: 130, height: 30, padding: "4px 10px", borderRadius: 999 }} placeholder="+ New label" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newLabel.trim()) { e.preventDefault(); addLabel(); } }} />
            </span>
          </div>
        </div>

        {task && status !== "done" && othersAssigned && (
          <div className="card card-tight" style={{ marginTop: 18, background: "var(--surface-2)" }}>
            <div className="row between wrap" style={{ gap: 10 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Still waiting on this?</div>
                <div className="small muted">Send a friendly reminder to whoever&apos;s assigned.</div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <button className="btn btn-sm" onClick={() => nudge("app")} disabled={pending}><I.bell style={{ width: 15 }} /> In-app</button>
                <button className="btn btn-sm" onClick={() => nudge("both")} disabled={pending}><I.nudge style={{ width: 15 }} /> App + email</button>
              </div>
            </div>
          </div>
        )}

        {msg && <p className="small" style={{ marginTop: 12, color: msg.bad ? "var(--danger)" : "var(--success)" }}>{msg.text}</p>}
        {!title.trim() && (description.trim() || assignees.length > 0) && <p className="small muted" style={{ marginTop: 12 }}>Add a name in the Task box at the top to create it.</p>}

        <div className="row between" style={{ marginTop: 20 }}>
          {task ? <button className="btn btn-ghost btn-danger btn-sm" onClick={remove} disabled={pending}><I.trash style={{ width: 15 }} /> Delete</button> : <span />}
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-ghost" onClick={requestClose}>Cancel</button>
            <button className="btn btn-accent" onClick={save} disabled={pending || !title.trim()} title={!title.trim() ? "Give the task a name first" : undefined}>{pending ? "Saving…" : task ? "Save" : "Create task"}</button>
          </div>
        </div>
      </Sheet>
        {confirmClose && (
          <div className="modal-confirm" role="alertdialog" aria-modal="true" aria-labelledby="discard-title">
            <div className="card" style={{ width: "min(340px, 100%)", padding: 20, textAlign: "center" }}>
              <h3 id="discard-title" style={{ fontSize: 18 }}>{task ? "Discard your changes?" : "Discard this task?"}</h3>
              <p className="small muted" style={{ margin: "6px 0 16px" }}>{task ? "Your edits won't be saved." : "What you've typed won't be saved."}</p>
              <div className="row" style={{ gap: 8, justifyContent: "center" }}>
                <button className="btn" autoFocus onClick={() => setConfirmClose(false)}>Keep editing</button>
                <button className="btn btn-danger" onClick={() => { setConfirmClose(false); onClose(); }}>Discard</button>
              </div>
            </div>
          </div>
        )}
    </>
  );
}
