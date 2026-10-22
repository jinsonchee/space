"use client";
import { useState, useTransition } from "react";
import { nudgeMember } from "../actions/tasks";

/** Home → Team status: one tap reminds a teammate about everything of theirs that's overdue. */
export default function NudgeButton({ memberId, name }: { memberId: string; name: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  if (msg) return <span className="tiny" style={{ color: msg.bad ? "var(--muted)" : "var(--success)", fontWeight: 600, textAlign: "right" }}>{msg.text}</span>;
  return (
    <button className="btn btn-sm" disabled={pending} aria-label={`Nudge ${name} about overdue tasks`}
      onClick={() => start(async () => { const r = await nudgeMember(memberId); setMsg(r.ok ? { text: "Nudged ✓" } : { text: r.error, bad: true }); })}>
      {pending ? "Sending…" : "Nudge"}
    </button>
  );
}
