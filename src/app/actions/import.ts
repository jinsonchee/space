"use server";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { requireMember, atLeast } from "@/lib/auth";

/** Minimal RFC-4180 CSV parser (quotes, escaped quotes, newlines inside quotes). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", q = false;
  const t = text.replace(/^﻿/, "");
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) {
      if (ch === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"' && cell === "") q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && t[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

function toDate(v: string): string | null {
  const s = v.trim();
  if (!s) return null;
  if (/^\d{12,14}$/.test(s)) return new Date(Number(s)).toISOString().slice(0, 10); // ms timestamp
  const cleaned = s.replace(/(\d+)(st|nd|rd|th)/g, "$1").replace(/^[A-Za-z]+,\s*/, "");
  if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) return cleaned.slice(0, 10);
  const d = new Date(cleaned);
  if (isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; // keep the calendar day as written
}

const pick = (header: string[], ...names: string[]) => {
  const h = header.map((x) => x.trim().toLowerCase());
  for (const n of names) { const i = h.indexOf(n); if (i >= 0) return i; }
  for (const n of names) { const i = h.findIndex((x) => x.includes(n)); if (i >= 0) return i; }
  return -1;
};

const splitList = (v: string) => v.replace(/^\[|\]$/g, "").split(/[,;|]/).map((x) => x.trim().replace(/^"|"$/g, "")).filter(Boolean);

export type ImportResult = { ok: true; created: number; skipped: number; unmatched: string[] } | { ok: false; error: string };

/** Imports a ClickUp CSV export into Space tasks. Assignees are matched to members by name or email. */
export async function importClickUpCsv(text: string): Promise<ImportResult> {
  const me = await requireMember();
  if (!atLeast(me, "admin")) return { ok: false, error: "Only admins can import tasks." };
  if (text.length > 5_000_000) return { ok: false, error: "That file is too big (5 MB max)." };
  const rows = parseCsv(text);
  if (rows.length < 2) return { ok: false, error: "The file looks empty." };
  const [header, ...data] = rows;
  const iName = pick(header, "task name", "name", "title");
  if (iName < 0) return { ok: false, error: "Couldn't find a “Task Name” column. Export a CSV from ClickUp and try again." };
  const iDesc = pick(header, "task content", "description", "content");
  const iStatus = pick(header, "status");
  const iDue = pick(header, "due date text", "due date", "due");
  const iAssign = pick(header, "assignees", "assignee");
  const iTags = pick(header, "tags", "labels");
  const iPrio = pick(header, "priority");

  const members = await sql<{ id: string; name: string; email: string | null }[]>`select id, name, email from members`;
  const findMember = (raw: string) => {
    const r = raw.toLowerCase();
    return members.find((m) => m.email?.toLowerCase() === r || m.name.toLowerCase() === r || r.startsWith(m.name.toLowerCase() + " ") || m.name.toLowerCase().split(" ")[0] === r.split(" ")[0]);
  };
  const labelCache = new Map((await sql<{ id: string; name: string }[]>`select id, name from labels`).map((l) => [l.name.toLowerCase(), l.id]));
  const colors = ["#8b5cf6", "#ff4fa3", "#ffb020", "#3b82f6", "#1ed760", "#22d3ee", "#ff6a3d"];

  let created = 0, skipped = 0;
  const unmatched = new Set<string>();
  for (const r of data) {
    const title = (r[iName] ?? "").trim().slice(0, 200);
    if (!title) { skipped++; continue; }
    const statusRaw = (iStatus >= 0 ? r[iStatus] : "").toLowerCase();
    const status = /complete|done|closed|finished/.test(statusRaw) ? "done" : /hold|block|wait|paus/.test(statusRaw) ? "hold" : /progress|review|doing|working/.test(statusRaw) ? "doing" : "todo";
    const prioRaw = (iPrio >= 0 ? r[iPrio] : "").toLowerCase();
    const priority = /urgent|high|1|2/.test(prioRaw) && !/low/.test(prioRaw) ? "high" : /low|4/.test(prioRaw) ? "low" : "normal";
    const due = iDue >= 0 ? toDate(r[iDue] ?? "") : null;
    const desc = iDesc >= 0 ? (r[iDesc] ?? "").slice(0, 5000) : "";
    // skip exact duplicates (same title + due) so re-importing is safe
    const [dupe] = await sql`select id from tasks where title = ${title} and due_date is not distinct from ${due}::date limit 1`;
    if (dupe) { skipped++; continue; }
    const [t] = await sql<{ id: string }[]>`
      insert into tasks (title, description, status, priority, due_date, created_by, completed_at)
      values (${title}, ${desc}, ${status}, ${priority}, ${due}, ${me.id}, ${status === "done" ? new Date() : null}) returning id`;
    created++;
    for (const a of iAssign >= 0 ? splitList(r[iAssign] ?? "") : []) {
      const m = findMember(a);
      if (m) await sql`insert into task_assignees (task_id, member_id) values (${t.id}, ${m.id}) on conflict do nothing`;
      else unmatched.add(a);
    }
    for (const tag of iTags >= 0 ? splitList(r[iTags] ?? "") : []) {
      const key = tag.toLowerCase().slice(0, 30);
      let lid = labelCache.get(key);
      if (!lid) {
        const [l] = await sql<{ id: string }[]>`insert into labels (name, color) values (${tag.slice(0, 30)}, ${colors[labelCache.size % colors.length]}) on conflict (name) do update set name = excluded.name returning id`;
        lid = l.id; labelCache.set(key, lid);
      }
      await sql`insert into task_labels (task_id, label_id) values (${t.id}, ${lid}) on conflict do nothing`;
    }
  }
  revalidatePath("/tasks");
  revalidatePath("/");
  return { ok: true, created, skipped, unmatched: [...unmatched] };
}
