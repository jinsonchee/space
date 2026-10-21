"use client";
import { useState } from "react";
import type { Access } from "@/lib/db";
import { MemberForm, type EditableMember } from "@/components/MemberForm";
import { PhotoUpload } from "@/components/PhotoUpload";
import { Photo } from "@/components/Photo";
import { I } from "@/components/Icons";
import { Sheet } from "@/components/Sheet";

type M = EditableMember & { photo: string | null; open: number };
const ACCESS_LABEL: Record<Access, string> = { master: "Artist · Master", admin: "Admin", member: "Member" };

export default function TeamClient({ members, viewer }: { members: M[]; viewer: { id: string; access: Access } }) {
  const [editing, setEditing] = useState<M | "new" | null>(null);
  const canEdit = (m: M) => m.id === viewer.id || viewer.access === "master" || (viewer.access === "admin" && m.access !== "master");
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Team</h1>
          <p className="muted">{members.length} {members.length === 1 ? "person" : "people"} in this Space</p>
        </div>
        {viewer.access !== "member" && <button className="btn btn-accent" onClick={() => setEditing("new")}><I.plus style={{ width: 18 }} /> Add someone</button>}
      </div>
      <div className="grid g-3">
        {members.map((m) => (
          <div key={m.id} className="card" style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <Photo src={m.photo} name={m.name} size={68} ring={m.access === "master"} />
            <div className="grow col" style={{ gap: 6 }}>
              <div>
                <div className="head" style={{ fontSize: 18 }}>{m.name}{m.id === viewer.id && <span className="muted small"> (you)</span>}</div>
                <div className="small muted">{m.role_label}</div>
              </div>
              <div className="row wrap" style={{ gap: 6 }}>
                <span className={`chip ${m.access === "master" ? "chip-accent" : ""}`}>{ACCESS_LABEL[m.access]}</span>
                <span className="chip">{m.open} open</span>
              </div>
            </div>
            {canEdit(m) && <button className="btn btn-sm" onClick={() => setEditing(m)}>Edit</button>}
          </div>
        ))}
      </div>

      <Sheet open={!!editing} onClose={() => setEditing(null)} label={editing === "new" ? "Add someone" : editing?.name ?? "Edit"}>
        {editing && (
          <div key={editing === "new" ? "new" : editing.id}>
            <div className="row between" style={{ marginBottom: 16 }}>
              <h2>{editing === "new" ? "Add someone" : editing.name}</h2>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setEditing(null)} aria-label="Close"><I.x style={{ width: 16 }} /></button>
            </div>
            {editing !== "new" && <div style={{ marginBottom: 18 }}><PhotoUpload memberId={editing.id} name={editing.name} src={editing.photo} /></div>}
            <MemberForm member={editing === "new" ? null : editing} viewer={viewer} onDone={() => setEditing(null)} />
          </div>
        )}
      </Sheet>
    </>
  );
}
