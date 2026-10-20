"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Access } from "@/lib/db";
import { updateMember, addMember, resetPin, removeMember } from "@/app/actions/members";
import { PRESETS } from "@/lib/characters";

export type EditableMember = { id: string; name: string; email: string | null; phone: string | null; role_label: string; access: Access };

/** Profile fields. Used for "My profile", editing a teammate (admins/master) and adding someone new. */
export function MemberForm({ member, viewer, onDone }: { member: EditableMember | null; viewer: { id: string; access: Access }; onDone?: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState({ name: member?.name ?? "", email: member?.email ?? "", phone: member?.phone ?? "", role_label: member?.role_label ?? "", access: (member?.access ?? "member") as Access });
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [pin, setPin] = useState<string | null>(null);
  const [preset, setPreset] = useState("");
  const isSelf = member?.id === viewer.id;
  const canChangeAccess = viewer.access === "master" && member?.access !== "master";
  const canAdmin = viewer.access !== "member" && !isSelf && member && (viewer.access === "master" || member.access !== "master");

  const save = () =>
    start(async () => {
      if (member) {
        const r = await updateMember(member.id, f);
        setMsg(r.ok ? { text: "Saved!" } : { text: r.error, bad: true });
        if (r.ok) { router.refresh(); onDone?.(); }
      } else {
        const r = await addMember({ ...f, preset });
        if (!r.ok) return setMsg({ text: r.error, bad: true });
        setPin(r.pin);
        router.refresh();
      }
    });

  if (pin) {
    return (
      <div className="col" style={{ gap: 14, textAlign: "center", alignItems: "center" }}>
        <h3>{f.name.split(" ")[0]} is in! 🎉</h3>
        <p className="small muted">Share this temporary PIN with them privately. It won&apos;t be shown again — they can change it in their profile.</p>
        <div className="head" style={{ fontSize: 40, letterSpacing: "0.2em", padding: "10px 20px", background: "var(--surface-2)", borderRadius: 16 }}>{pin}</div>
        <p className="small muted">They log in with: <strong style={{ color: "var(--text)" }}>{f.email || f.phone}</strong></p>
        <button className="btn btn-accent" onClick={onDone}>Done</button>
      </div>
    );
  }

  return (
    <div className="col" style={{ gap: 12 }}>
      {!member && (
        <div className="field">
          <label className="label">Quick fill from the crew</label>
          <select className="select" value={preset} onChange={(e) => {
            const p = PRESETS.find((x) => x.key === e.target.value);
            setPreset(e.target.value);
            if (p) setF({ ...f, name: p.name, role_label: p.role });
          }}>
            <option value="">Someone new</option>
            {PRESETS.filter((p) => p.role !== "Artist").map((p) => <option key={p.key} value={p.key}>{p.name} · {p.role}</option>)}
          </select>
          <span className="tiny muted" style={{ marginTop: 6 }}>Brings in their photo and pixel character too.</span>
        </div>
      )}
      <div className="grid g-2" style={{ gap: 12 }}>
        <div className="field"><label className="label">Name</label><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="field"><label className="label">Role label</label><input className="input" value={f.role_label} placeholder="Manager, Videographer…" onChange={(e) => setF({ ...f, role_label: e.target.value })} /></div>
        <div className="field"><label className="label">Email</label><input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div className="field"><label className="label">Phone</label><input className="input" type="tel" value={f.phone} placeholder="+60…" onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
      </div>
      {(canChangeAccess || (!member && viewer.access === "master")) && (
        <div className="field">
          <span className="label">Access</span>
          <div className="seg">
            <button type="button" aria-pressed={f.access === "member"} onClick={() => setF({ ...f, access: "member" })}>Member</button>
            <button type="button" aria-pressed={f.access === "admin"} onClick={() => setF({ ...f, access: "admin" })}>Admin</button>
          </div>
          <span className="tiny muted" style={{ marginTop: 6 }}>Admins can add people, edit profiles, reset PINs and update stats.</span>
        </div>
      )}
      {msg && <p className="small" style={{ color: msg.bad ? "var(--danger)" : "var(--accent)" }}>{msg.text}</p>}
      <div className="row between wrap" style={{ gap: 8, marginTop: 4 }}>
        <div className="row" style={{ gap: 6 }}>
          {canAdmin && (
            <>
              <button className="btn btn-sm" disabled={pending} onClick={() => start(async () => { if (!confirm(`Give ${member!.name} a new PIN?`)) return; const r = await resetPin(member!.id); if (r.ok) setMsg({ text: `New PIN for ${member!.name.split(" ")[0]}: ${r.pin} — share it privately.` }); else setMsg({ text: r.error, bad: true }); })}>Reset PIN</button>
              <button className="btn btn-sm btn-ghost btn-danger" disabled={pending} onClick={() => start(async () => { if (!confirm(`Remove ${member!.name} from this Space?`)) return; const r = await removeMember(member!.id); if (r.ok) { router.refresh(); onDone?.(); } else setMsg({ text: r.error, bad: true }); })}>Remove</button>
            </>
          )}
        </div>
        <button className="btn btn-accent" onClick={save} disabled={pending}>{pending ? "Saving…" : member ? "Save changes" : "Add to Space"}</button>
      </div>
    </div>
  );
}
