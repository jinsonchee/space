"use client";
import { useState, useTransition } from "react";
import { disconnectCalendar } from "../../actions/calendar";

export type CalendarInfo = { configured: boolean; email: string | null; status: "ok" | "expired" | null };

const RESULT: Record<string, { text: string; bad?: boolean; info?: boolean }> = {
  connected: { text: "Connected! Your events now show on Home and My Week 🗓️" },
  cancelled: { text: "No problem, nothing was connected.", info: true },
  noscope: { text: "Google didn't share your calendar. Try again and leave the calendar box ticked.", bad: true },
  failed: { text: "That didn't work. Please try connecting again.", bad: true },
  unavailable: { text: "Google Calendar isn't set up for this Space yet. Ask whoever set up your Space.", bad: true },
};

export function CalendarCard({ info, result }: { info: CalendarInfo; result: string | null }) {
  const [pending, start] = useTransition();
  const [status, setStatus] = useState(info.status);
  const msg = result ? RESULT[result] : null;
  const connect = (label: string) => <a className="btn btn-accent" href="/api/google/connect">{label}</a>;

  return (
    <section className="card" id="calendar">
      <h2 style={{ marginBottom: 6 }}>Google Calendar</h2>
      <p className="small muted" style={{ marginBottom: 14 }}>Show your events on Home and My Week. Read-only: Space can see your main calendar but never changes it. <a href="/privacy" style={{ textDecoration: "underline" }}>Privacy</a></p>
      {msg && <p className="small" style={{ marginBottom: 12, color: msg.bad ? "var(--danger)" : msg.info ? "var(--muted)" : "var(--success)" }}>{msg.text}</p>}

      {!info.configured ? (
        <p className="small faint">Not available yet. Whoever set up this Space needs to add Google Calendar.</p>
      ) : status === "ok" ? (
        <div className="row between wrap" style={{ gap: 10 }}>
          <span className="small">Connected{info.email ? <> as <strong>{info.email}</strong></> : null}</span>
          <button className="btn btn-sm btn-ghost" disabled={pending} onClick={() => start(async () => { await disconnectCalendar(); setStatus(null); })}>Disconnect</button>
        </div>
      ) : status === "expired" ? (
        <div className="col" style={{ gap: 10 }}>
          <p className="small" style={{ color: "var(--warn)" }}>Your connection expired, so your events aren&apos;t showing.</p>
          <div>{connect("Reconnect Google Calendar")}</div>
        </div>
      ) : (
        <div className="col" style={{ gap: 10 }}>
          <div>{connect("Connect Google Calendar")}</div>
          <p className="tiny muted">
            Google will say <strong>&ldquo;Google hasn&apos;t verified this app&rdquo;</strong>. That&apos;s expected: this is your Space&apos;s own private app.
            Click <strong>Advanced</strong>, then <strong>Go to&nbsp;… (unsafe)</strong>, then allow calendar access.
          </p>
        </div>
      )}
    </section>
  );
}
