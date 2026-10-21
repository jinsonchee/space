"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveStats } from "../actions/stats";
import { PLATFORMS } from "@/lib/levels";
import { I } from "@/components/Icons";
import { Sheet } from "@/components/Sheet";

export default function StatsEditor({ current, auto = [] }: { current: Record<string, number>; auto?: string[] }) {
  const [open, setOpen] = useState(false);
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(PLATFORMS.map((p) => [p.key, current[p.key]?.toString() ?? ""])));
  const [pending, start] = useTransition();
  const router = useRouter();
  const save = () =>
    start(async () => {
      const out: Record<string, number | null> = {};
      for (const p of PLATFORMS) out[p.key] = vals[p.key] === "" || auto.includes(p.key) ? null : Number(vals[p.key].replace(/[^\d]/g, ""));
      await saveStats(out);
      setOpen(false);
      router.refresh();
    });
  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}><I.sparkle style={{ width: 16 }} /> Update stats</button>
      <Sheet open={open} onClose={() => setOpen(false)} label="Update stats">
        <h2>Today&apos;s numbers</h2>
        <p className="small muted" style={{ margin: "6px 0 18px" }}>Pop in your latest counts. Your level and growth update instantly.</p>
        <div className="grid g-2" style={{ gap: 12 }}>
          {PLATFORMS.map((p) => (
            <div className="field" key={p.key}>
              <label className="label">{p.name} · {p.metric}</label>
              {auto.includes(p.key)
                ? <input className="input" value={`${vals[p.key]} · updates automatically`} disabled title="Linked in Settings → YouTube stats" />
                : <input className="input" inputMode="numeric" value={vals[p.key]} onChange={(e) => setVals((v) => ({ ...v, [p.key]: e.target.value }))} placeholder="0" />}
            </div>
          ))}
        </div>
        <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn btn-accent" onClick={save} disabled={pending}>{pending ? "Saving…" : "Save stats"}</button>
        </div>
      </Sheet>
    </>
  );
}
