"use client";
import { useState, useTransition } from "react";
import { disconnectCalendar, turnOffGoogleFeature } from "../../actions/calendar";

export type GoogleInfo = { configured: boolean; email: string | null; status: "ok" | "expired" | null; features: ("calendar" | "gmail")[] };

const RESULT: Record<string, { text: string; bad?: boolean; info?: boolean }> = {
  connected: { text: "Connected! ✓" },
  cancelled: { text: "No problem, nothing was changed.", info: true },
  noscope: { text: "Google didn't share everything Space needs. Try again and leave all the boxes ticked.", bad: true },
  failed: { text: "That didn't work. Please try again.", bad: true },
  unavailable: { text: "Google isn't set up for this Space yet. Ask whoever set up your Space.", bad: true },
};

const FEATURES = [
  { key: "calendar" as const, name: "Calendar", what: "Today's events on Home, and each day's events in My Week. Read-only." },
  { key: "gmail" as const, name: "Gmail", what: "Your inbox in Space: read, reply, and turn emails into tasks." },
];

export function GoogleCard({ info, result }: { info: GoogleInfo; result: string | null }) {
  const [pending, start] = useTransition();
  const [features, setFeatures] = useState(info.features);
  const [status, setStatus] = useState(info.status);
  const msg = result ? RESULT[result] : null;
  const connected = status !== null && features.length > 0;

  return (
    <section className="card" id="google">
      <h2 style={{ marginBottom: 6 }}>Google</h2>
      <p className="small muted" style={{ marginBottom: 14 }}>
        Bring your own Google Calendar and Gmail into Space. Only you see them. <a href="/privacy" style={{ textDecoration: "underline" }}>Privacy</a>
      </p>
      {msg && <p className="small" style={{ marginBottom: 12, color: msg.bad ? "var(--danger)" : msg.info ? "var(--muted)" : "var(--success)" }}>{msg.text}</p>}

      {!info.configured ? (
        <p className="small faint">Not available yet. Whoever set up this Space needs to add Google first.</p>
      ) : (
        <>
          {status === "expired" && (
            <div className="row between wrap" style={{ gap: 10, marginBottom: 12 }}>
              <p className="small" style={{ color: "var(--warn)" }}>Your Google connection expired.</p>
              <a className="btn btn-sm btn-accent" href={`/api/google/connect?want=${features[0] ?? "calendar"}`}>Reconnect</a>
            </div>
          )}
          <div className="col" style={{ gap: 10 }}>
            {FEATURES.map((f) => {
              const on = features.includes(f.key);
              return (
                <div key={f.key} className="row between wrap" style={{ gap: 10, padding: "10px 0", borderTop: "1px solid var(--line)" }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{f.name} {on && <span className="small" style={{ color: "var(--success)", fontWeight: 600 }}>· On</span>}</div>
                    <div className="tiny muted">{f.what}</div>
                  </div>
                  {on ? (
                    <button className="btn btn-sm btn-ghost" disabled={pending} onClick={() => start(async () => { await turnOffGoogleFeature(f.key); setFeatures((x) => x.filter((y) => y !== f.key)); })}>Turn off</button>
                  ) : (
                    <a className="btn btn-sm btn-accent" href={`/api/google/connect?want=${f.key}`}>Turn on</a>
                  )}
                </div>
              );
            })}
          </div>
          {connected ? (
            <div className="row between wrap" style={{ gap: 10, marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
              <span className="small">Connected{info.email ? <> as <strong>{info.email}</strong></> : null}</span>
              <button className="btn btn-sm btn-ghost" disabled={pending} onClick={() => start(async () => { await disconnectCalendar(); setStatus(null); setFeatures([]); })}>Disconnect Google</button>
            </div>
          ) : (
            <p className="tiny muted" style={{ marginTop: 10 }}>
              Google will say <strong>&ldquo;Google hasn&apos;t verified this app&rdquo;</strong>. That&apos;s expected: this is your Space&apos;s own private app.
              Click <strong>Advanced</strong>, then <strong>Go to&nbsp;… (unsafe)</strong>, then leave all the boxes ticked.
            </p>
          )}
        </>
      )}
    </section>
  );
}
