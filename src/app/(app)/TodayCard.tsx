"use client";
import { useEffect, useState } from "react";
import type { CalEvent, CalendarResult } from "@/lib/google";

/** Today's Google Calendar events with a live "Now: …" / "Next up in …" line. */
export default function TodayCard({ cal, events }: { cal: CalendarResult["state"] | "connect"; events: CalEvent[] }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="card">
      <div className="card-title">
        <div>
          <span className="eyebrow">Today</span>
          <h2 style={{ marginTop: 4 }}>{cal === "ok" && now !== null ? liveLine(events, now) : "Your calendar"}</h2>
        </div>
        {cal === "ok" && <span className="small muted">{events.length} event{events.length === 1 ? "" : "s"}</span>}
      </div>
      {cal === "connect" && (
        <div className="row between wrap" style={{ gap: 10 }}>
          <p className="small muted">See today&apos;s events here by connecting your Google Calendar.</p>
          <a href="/api/google/connect?want=calendar" className="btn btn-sm">Connect calendar</a>
        </div>
      )}
      {cal === "expired" && (
        <div className="row between wrap" style={{ gap: 10 }}>
          <p className="small" style={{ color: "var(--warn)" }}>Your Google Calendar connection expired.</p>
          <a href="/api/google/connect" className="btn btn-sm btn-accent">Reconnect</a>
        </div>
      )}
      {cal === "error" && <p className="small muted">Couldn&apos;t load your calendar just now. It&apos;ll try again next time.</p>}
      {cal === "ok" && <EventList events={events} now={now} empty="Nothing on your calendar today." />}
    </section>
  );
}

export function EventList({ events, now, empty }: { events: CalEvent[]; now: number | null; empty: string }) {
  if (!events.length) return <p className="small muted">{empty}</p>;
  return (
    <ul className="event-list">
      {events.map((e) => {
        const live = now !== null && !e.allDay && e.startMs <= now && now < e.endMs;
        const past = now !== null && !e.allDay && e.endMs <= now;
        return (
          <li key={e.id} className={`event ${live ? "event-live" : ""} ${past ? "event-past" : ""}`}>
            <span className="event-time">{e.time}</span>
            <span style={{ minWidth: 0 }}>
              <span className="event-title">{e.title}</span>
              {e.location && <span className="event-loc">{e.location}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function liveLine(events: CalEvent[], now: number) {
  const timed = events.filter((e) => !e.allDay);
  const current = timed.find((e) => e.startMs <= now && now < e.endMs);
  if (current) return `Now: ${current.title}`;
  const next = timed.find((e) => e.startMs > now);
  if (!next) return timed.length ? "All done for today" : events.length ? "No timed events today" : "Clear day";
  const mins = Math.round((next.startMs - now) / 60_000);
  if (mins < 1) return `Starting now: ${next.title}`;
  if (mins < 60) return `Next up in ${mins} min: ${next.title}`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return `Next up in ${h}h${m ? ` ${m}m` : ""}: ${next.title}`;
}
