"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Pet } from "./Pixel";
import type { PetKind } from "@/lib/sprites";

type Note = { id: string; kind: string; title: string; body: string; link: string | null; read_at: string | null; created_at: string };

function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** The pet mascot lives in the corner and delivers every notification as a speech bubble. */
export function PetDock({ pet, petName }: { pet?: PetKind; petName: string }) {
  const [items, setItems] = useState<Note[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [peek, setPeek] = useState<Note | null>(null);
  const seen = useRef<Set<string> | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/notifications", { cache: "no-store" });
      if (!r.ok) return;
      const j = (await r.json()) as { items: Note[]; unread: number };
      setItems(j.items);
      setUnread(j.unread);
      if (seen.current === null) {
        seen.current = new Set(j.items.map((i) => i.id));
        const first = j.items.find((i) => !i.read_at);
        if (first) setPeek(first); // greet with the latest unread on load
      } else {
        const fresh = j.items.find((i) => !i.read_at && !seen.current!.has(i.id));
        j.items.forEach((i) => seen.current!.add(i.id));
        if (fresh) setPeek(fresh);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 3000); // after the loading screen
    const t = setInterval(load, 30000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    window.addEventListener("space:refresh-notes", onFocus);
    return () => { clearTimeout(first); clearInterval(t); window.removeEventListener("focus", onFocus); window.removeEventListener("space:refresh-notes", onFocus); };
  }, [load]);

  useEffect(() => {
    if (!peek) return;
    const t = setTimeout(() => setPeek(null), 9000);
    return () => clearTimeout(t);
  }, [peek]);

  const markAll = async () => {
    await fetch("/api/notifications", { method: "POST", body: "{}" });
    setUnread(0);
    setItems((x) => x.map((i) => ({ ...i, read_at: i.read_at ?? new Date().toISOString() })));
  };
  const markOne = (id: string) => fetch("/api/notifications", { method: "POST", body: JSON.stringify({ ids: [id] }) }).then(() => load());

  return (
    <div className="pet-dock">
      {open ? (
        <div className="bubble" style={{ width: "min(340px, calc(100vw - 110px))", maxWidth: "none", padding: 10 }}>
          <div className="row between" style={{ padding: "4px 6px 8px" }}>
            <strong className="head" style={{ fontSize: 15 }}>{petName}&apos;s mailbag</strong>
            <div className="row" style={{ gap: 4 }}>
              {unread > 0 && <button className="btn btn-ghost btn-sm" onClick={markAll}>Mark all read</button>}
              <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setOpen(false)} aria-label="Close">✕</button>
            </div>
          </div>
          <div style={{ maxHeight: 360, overflow: "auto" }}>
            {items.length === 0 && <p className="small muted" style={{ padding: 12 }}>Nothing yet — I&apos;ll flap over when something comes up!</p>}
            {items.map((n) => {
              const inner = (
                <>
                  <div className="grow">
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{n.title}</div>
                    {n.body && <div className="small muted" style={{ whiteSpace: "pre-line" }}>{n.body}</div>}
                    <div className="tiny faint" style={{ marginTop: 2 }}>{ago(n.created_at)}</div>
                  </div>
                  {!n.read_at && <span className="dot" style={{ background: "var(--accent)", marginTop: 6 }} />}
                </>
              );
              return n.link ? (
                <Link key={n.id} href={n.link} className={`notif ${n.read_at ? "" : "unread"}`} onClick={() => { markOne(n.id); setOpen(false); }}>{inner}</Link>
              ) : (
                <div key={n.id} className={`notif ${n.read_at ? "" : "unread"}`} onClick={() => markOne(n.id)}>{inner}</div>
              );
            })}
          </div>
        </div>
      ) : peek ? (
        <div className="bubble" onClick={() => { setOpen(true); setPeek(null); }} style={{ cursor: "pointer" }}>
          <div className="tiny faint" style={{ fontWeight: 700, marginBottom: 2 }}>{petName} says</div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{peek.title}</div>
          {peek.body && <div className="small muted" style={{ marginTop: 2, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{peek.body}</div>}
        </div>
      ) : null}
      <button className="pet-button" onClick={() => { setOpen((o) => !o); setPeek(null); }} aria-label={`${petName}: ${unread} new notifications`}>
        <Pet kind={pet} size={60} />
        {unread > 0 && <span className="pet-badge">{unread > 9 ? "9+" : unread}</span>}
      </button>
    </div>
  );
}
