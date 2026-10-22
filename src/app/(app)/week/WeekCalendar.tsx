"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CalEvent } from "@/lib/google";
import { addDays, prettyDay } from "@/lib/dates";
import { I } from "@/components/Icons";
import { Sheet, useIsPhone } from "@/components/Sheet";

const HOUR = 48; // px per hour
const NEW_EVENT = "https://calendar.google.com/calendar/r/eventedit";

type Placed = { e: CalEvent; top: number; height: number; col: number; cols: number };

/** Side-by-side columns for events that overlap, like Google Calendar. */
function layout(day: string, dayStart: number, dayEnd: number, events: CalEvent[]): Placed[] {
  const timed = events
    .filter((e) => !e.allDay && e.startMs < dayEnd && e.endMs > dayStart)
    .map((e) => ({ e, s: Math.max(e.startMs, dayStart), f: Math.min(e.endMs, dayEnd) }))
    .sort((a, b) => a.s - b.s || b.f - a.f);
  const out: Placed[] = [];
  let group: (Placed & { f: number })[] = [], groupEnd = -Infinity;
  const flush = () => { const cols = Math.max(...group.map((g) => g.col)) + 1; group.forEach((g) => out.push({ ...g, cols })); group = []; };
  for (const t of timed) {
    if (t.s >= groupEnd && group.length) flush();
    const used = new Set(group.filter((g) => g.f > t.s).map((g) => g.col));
    let col = 0; while (used.has(col)) col++;
    const top = ((t.s - dayStart) / 3_600_000) * HOUR;
    group.push({ e: t.e, top, height: Math.max(((t.f - t.s) / 3_600_000) * HOUR, 22), col, cols: 1, f: t.f });
    groupEnd = Math.max(groupEnd, t.f);
  }
  if (group.length) flush();
  void day;
  return out;
}

/** Her Google Calendar as a week grid (laptop) or one day at a time (phone). Read-only, synced live from Google. */
export default function WeekCalendar({ monday, today, day, dayStarts, events, calExpired }: {
  monday: string; today: string; day: string; dayStarts: Record<string, number>; events: CalEvent[] | null; calExpired: boolean;
}) {
  const phone = useIsPhone();
  const [picked, setPicked] = useState(day);
  const [open, setOpen] = useState<CalEvent | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  useEffect(() => setPicked(day), [day]);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t); }, []);

  const placed = useMemo(() => Object.fromEntries(week.map((d) => [d, layout(d, dayStarts[d], dayStarts[addDays(d, 1)], events ?? [])])), [events, monday]); // eslint-disable-line react-hooks/exhaustive-deps
  const allDay = (d: string) => (events ?? []).filter((e) => e.allDay && e.start <= d && d < e.end);

  // Open the grid around her day: the earliest event this week, or 8am.
  useEffect(() => {
    const tops = week.flatMap((d) => placed[d].map((p) => p.top));
    const first = Math.min(8 * HOUR, ...(tops.length ? tops : [8 * HOUR]));
    if (scroller.current) scroller.current.scrollTop = Math.max(first - HOUR / 2, 0);
  }, [monday]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!events) {
    return (
      <div className="empty">
        <p style={{ fontWeight: 600, color: "var(--text)" }}>{calExpired ? "Your Google Calendar connection expired" : "Connect your Google Calendar"}</p>
        <p className="small" style={{ margin: "6px 0 14px" }}>Your events show up here as a week view, synced live from Google.</p>
        <a className="btn btn-accent" href="/api/google/connect?want=calendar">{calExpired ? "Reconnect" : "Connect Google Calendar"}</a>
      </div>
    );
  }

  const days = phone ? [picked] : week;
  const label = (d: string, o: Intl.DateTimeFormatOptions) => new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { ...o, timeZone: "UTC" });
  const nowTop = (d: string) => (now !== null && d === today ? ((now - dayStarts[d]) / 3_600_000) * HOUR : null);
  const hasAllDay = days.some((d) => allDay(d).length > 0);

  return (
    <div className="wcal" style={{ ["--cols" as string]: days.length }}>
      {/* Phone: pick a day. Laptop: the week's day headers. */}
      {phone ? (
        <div className="wcal-strip" role="tablist" aria-label="Day">
          {week.map((d) => (
            <button key={d} role="tab" aria-selected={d === picked} className={`wcal-chip ${d === picked ? "on" : ""} ${d === today ? "today" : ""}`} onClick={() => setPicked(d)}>
              <span>{label(d, { weekday: "short" })}</span><strong>{Number(d.slice(8))}</strong>
              <i className={(events.some((e) => (e.allDay ? e.start <= d && d < e.end : e.startMs < dayStarts[addDays(d, 1)] && e.endMs > dayStarts[d])) ? "has" : "")} />
            </button>
          ))}
        </div>
      ) : (
        <div className="wcal-head">
          <span />
          {days.map((d) => (
            <div key={d} className={`wcal-day ${d === today ? "today" : ""}`}>
              <span>{label(d, { weekday: "short" })}</span><strong>{Number(d.slice(8))}</strong>
            </div>
          ))}
        </div>
      )}

      {hasAllDay && (
        <div className="wcal-allday">
          <span className="wcal-gutter-label">All day</span>
          {days.map((d) => (
            <div key={d} className="wcal-allday-col">
              {allDay(d).map((e) => (
                <button key={e.id} className="wcal-chipevent" style={{ ["--c" as string]: e.color }} onClick={() => setOpen(e)}>{e.title}</button>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="wcal-scroll" ref={scroller}>
        <div className="wcal-grid" style={{ height: 24 * HOUR }}>
          <div className="wcal-hours" aria-hidden>
            {Array.from({ length: 24 }, (_, h) => <span key={h} style={{ top: h * HOUR }}>{h === 0 ? "" : `${String(h).padStart(2, "0")}:00`}</span>)}
          </div>
          {days.map((d) => (
            <div key={d} className={`wcal-col ${d === today ? "today" : ""}`}>
              {placed[d].map((p) => {
                const short = p.height < 40;
                return (
                  <button key={p.e.id + d} className={`wcal-event ${short ? "short" : ""} ${now !== null && p.e.endMs < now ? "past" : ""}`}
                    style={{ top: p.top, height: p.height - 2, left: `calc(${(p.col / p.cols) * 100}% + 2px)`, width: `calc(${100 / p.cols}% - 4px)`, ["--c" as string]: p.e.color }}
                    onClick={() => setOpen(p.e)}>
                    <strong>{p.e.title}</strong>
                    <span>{short ? p.e.time.split("–")[0] : p.e.time}</span>
                    {!short && p.e.location && <span className="wcal-loc">{p.e.location}</span>}
                  </button>
                );
              })}
              {nowTop(d) !== null && <div className="wcal-now" style={{ top: nowTop(d)! }} aria-label="Now" />}
            </div>
          ))}
        </div>
      </div>

      <div className="wcal-foot">
        <span className="tiny muted">Synced live from Google Calendar. Add or change events there.</span>
        <a className="sec-link" href={NEW_EVENT} target="_blank" rel="noreferrer"><I.plus style={{ width: 16 }} /> New event in Google</a>
      </div>

      <Sheet open={!!open} onClose={() => setOpen(null)} label={open?.title ?? "Event"} width="min(420px, 100%)">
        {open && (
          <div className="col" style={{ gap: 12 }}>
            <div className="row" style={{ gap: 10, alignItems: "flex-start" }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: open.color, marginTop: 6, flexShrink: 0 }} />
              <div>
                <h2 style={{ fontSize: 20 }}>{open.title}</h2>
                <p className="small muted" style={{ marginTop: 4 }}>
                  {open.allDay ? (open.end > addDays(open.start, 1) ? `${prettyDay(open.start)} – ${prettyDay(addDays(open.end, -1))}` : `${prettyDay(open.start)} · All day`) : `${prettyDay(Object.keys(dayStarts).filter((k) => dayStarts[k] <= open.startMs).sort().pop() ?? picked)} · ${open.time}`}
                </p>
                {open.location && <p className="small" style={{ marginTop: 6 }}>{open.location}</p>}
              </div>
            </div>
            <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-ghost" onClick={() => setOpen(null)}>Close</button>
              {open.link && <a className="btn" href={open.link} target="_blank" rel="noreferrer">Open in Google Calendar</a>}
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
