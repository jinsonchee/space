"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveGoal, deleteGoal } from "../actions/goals";
import { PLATFORMS } from "@/lib/levels";
import { I } from "@/components/Icons";
import { Sheet } from "@/components/Sheet";

type G = { id: string; title: string; kind: "milestones" | "metric"; platform: string | null; target_value: number | null; end_date: string; is_primary: boolean };

export default function GoalEditor({ mode, goal, today }: { mode: "new" | "edit"; goal?: G; today: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({
    title: goal?.title ?? "",
    kind: goal?.kind ?? ("milestones" as G["kind"]),
    platform: goal?.platform ?? "spotify",
    target: goal?.target_value?.toString() ?? "",
    end: goal?.end_date ?? `${today.slice(0, 4)}-12-31`,
    primary: goal?.is_primary ?? false,
  });

  const save = () =>
    start(async () => {
      const r = await saveGoal({
        id: goal?.id, title: f.title, kind: f.kind, platform: f.kind === "metric" ? f.platform : null,
        target_value: f.kind === "metric" ? Number(f.target.replace(/[^\d]/g, "")) : null, end_date: f.end, is_primary: f.primary,
      });
      if (!r.ok) return setErr(r.error);
      setOpen(false);
      router.refresh();
    });

  return (
    <>
      {mode === "new" ? (
        <button className="btn btn-accent btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setOpen(true)}><I.plus style={{ width: 16 }} /> Add a goal</button>
      ) : (
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>Edit</button>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} label={mode === "new" ? "New goal" : "Edit goal"}>
        <h2>{mode === "new" ? "New goal" : "Edit goal"}</h2>
        <p className="small muted" style={{ margin: "6px 0 18px" }}>Keep it real and measurable. Then link tasks to it so the day-to-day work shows up as progress.</p>
        <div className="col" style={{ gap: 14 }}>
          <div className="field">
            <label className="label">Goal</label>
            <input className="input" value={f.title} placeholder="Release the “love” album · Hit 10K monthly listeners" onChange={(e) => setF({ ...f, title: e.target.value })} />
          </div>
          <div className="field">
            <span className="label">How do we measure it?</span>
            <div className="seg">
              <button type="button" aria-pressed={f.kind === "milestones"} onClick={() => setF({ ...f, kind: "milestones" })}>By finishing linked tasks</button>
              <button type="button" aria-pressed={f.kind === "metric"} onClick={() => setF({ ...f, kind: "metric" })}>By growing a number</button>
            </div>
          </div>
          {f.kind === "metric" && (
            <div className="grid g-2" style={{ gap: 12 }}>
              <div className="field">
                <label className="label">Number to grow</label>
                <select className="select" value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value })}>
                  {PLATFORMS.map((p) => <option key={p.key} value={p.key}>{p.name} {p.metric}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="label">Target</label>
                <input className="input" inputMode="numeric" value={f.target} placeholder="10000" onChange={(e) => setF({ ...f, target: e.target.value })} />
              </div>
            </div>
          )}
          <div className="grid g-2" style={{ gap: 12 }}>
            <div className="field">
              <label className="label">Finish by</label>
              <input className="input" type="date" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} />
            </div>
            <label className="row small" style={{ gap: 8, fontWeight: 600, alignSelf: "end", paddingBottom: 10, cursor: "pointer" }}>
              <input type="checkbox" checked={f.primary} onChange={(e) => setF({ ...f, primary: e.target.checked })} /> Main goal (shown on Home)
            </label>
          </div>
          {err && <p className="small" style={{ color: "var(--danger)" }}>{err}</p>}
          <div className="row between" style={{ marginTop: 6 }}>
            {goal ? (
              <button className="btn btn-ghost btn-danger btn-sm" disabled={pending} onClick={() => start(async () => { if (!confirm("Delete this goal? Linked tasks stay, just unlinked.")) return; await deleteGoal(goal.id); setOpen(false); router.refresh(); })}>
                <I.trash style={{ width: 15 }} /> Delete
              </button>
            ) : <span />}
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn-accent" onClick={save} disabled={pending || !f.title.trim()}>{pending ? "Saving…" : "Save goal"}</button>
            </div>
          </div>
        </div>
      </Sheet>
    </>
  );
}
