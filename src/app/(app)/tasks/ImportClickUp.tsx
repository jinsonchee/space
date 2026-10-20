"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importClickUpCsv, type ImportResult } from "../../actions/import";
import { I } from "@/components/Icons";

export function ImportClickUp() {
  const [open, setOpen] = useState(false);
  const [res, setRes] = useState<ImportResult | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (file: File | null) => {
    if (!file) return;
    start(async () => {
      const r = await importClickUpCsv(await file.text());
      setRes(r);
      if (r.ok) router.refresh();
    });
  };
  return (
    <>
      <button className="btn" onClick={() => { setRes(null); setOpen(true); }}>Import from ClickUp</button>
      {open && (
        <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-label="Import from ClickUp">
            <div className="row between" style={{ marginBottom: 12 }}>
              <h2>Bring your ClickUp tasks over</h2>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setOpen(false)} aria-label="Close"><I.x style={{ width: 16 }} /></button>
            </div>
            <ol className="small muted" style={{ paddingLeft: 18, margin: "0 0 16px", lineHeight: 1.7 }}>
              <li>In ClickUp, open the List or Space with your team&apos;s tasks.</li>
              <li>Use its <strong style={{ color: "var(--text)" }}>Export</strong> option and choose <strong style={{ color: "var(--text)" }}>CSV</strong>.</li>
              <li>Drop the file below. Names, statuses, due dates, assignees, tags and priority come across.</li>
            </ol>
            <label className="empty" style={{ display: "block", cursor: "pointer" }}>
              <input type="file" accept=".csv,text/csv" hidden onChange={(e) => run(e.target.files?.[0] ?? null)} />
              <strong style={{ color: "var(--text)" }}>{pending ? "Importing…" : "Choose ClickUp CSV"}</strong>
              <div className="small" style={{ marginTop: 4 }}>Safe to run twice — duplicates are skipped.</div>
            </label>
            {res && (res.ok ? (
              <div className="card card-tight" style={{ marginTop: 14, background: "var(--surface-2)" }}>
                <strong>Imported {res.created} task{res.created === 1 ? "" : "s"} 🎉</strong>
                {res.skipped > 0 && <div className="small muted">{res.skipped} skipped (blank or already here).</div>}
                {res.unmatched.length > 0 && (
                  <div className="small" style={{ marginTop: 6, color: "var(--warn)" }}>
                    Couldn&apos;t match these assignees to anyone in your Space: {res.unmatched.join(", ")}. Add them in Team, then re-import.
                  </div>
                )}
              </div>
            ) : (
              <p className="small" style={{ color: "var(--danger)", marginTop: 12 }}>{res.error}</p>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
