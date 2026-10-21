"use client";
import { useState, useTransition } from "react";
import { NOTIFY_KINDS, wants, type NotifyPrefs } from "@/lib/notify-prefs";
import { saveNotifyPrefs } from "../../actions/members";

export function NotificationsCard({ prefs: initial, emailOn }: { prefs: NotifyPrefs; emailOn: boolean }) {
  const [prefs, setPrefs] = useState(() => Object.fromEntries(NOTIFY_KINDS.map((k) => [k.kind, { app: wants(initial, k.kind, "app"), email: wants(initial, k.kind, "email") }])));
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const flip = (kind: string, ch: "app" | "email") => {
    const next = { ...prefs, [kind]: { ...prefs[kind], [ch]: !prefs[kind][ch] } };
    setPrefs(next);
    start(async () => { await saveNotifyPrefs(next); setSaved(kind); setTimeout(() => setSaved((s) => (s === kind ? null : s)), 1500); });
  };
  return (
    <section className="card" id="notifications">
      <h2 style={{ marginBottom: 6 }}>Notifications</h2>
      <p className="small muted" style={{ marginBottom: 14 }}>Choose what you hear about, and how. The dove brings notifications inside Space.</p>
      <div className="notify-grid" role="table" aria-label="Notification settings">
        <div role="row" className="notify-row notify-head">
          <span role="columnheader" />
          <span role="columnheader" className="tiny muted">Dove</span>
          <span role="columnheader" className="tiny muted">Email</span>
        </div>
        {NOTIFY_KINDS.map((k) => (
          <div role="row" key={k.kind} className="notify-row">
            <span role="cell" className="small">
              {k.name}
              {"note" in k && <span className="tiny muted" style={{ display: "block" }}>{k.note}</span>}
              {saved === k.kind && <span className="tiny" style={{ color: "var(--success)", marginLeft: 6 }}>Saved ✓</span>}
            </span>
            {(["app", "email"] as const).map((ch) => (
              <span role="cell" key={ch}>
                <button type="button" role="switch" aria-checked={prefs[k.kind][ch]} aria-label={`${k.name}: ${ch === "app" ? "dove" : "email"}`}
                  className={`switch ${prefs[k.kind][ch] ? "on" : ""}`} disabled={pending || (ch === "email" && !emailOn)} onClick={() => flip(k.kind, ch)}>
                  <span />
                </button>
              </span>
            ))}
          </div>
        ))}
      </div>
      {!emailOn && <p className="tiny muted" style={{ marginTop: 10 }}>Email notifications aren&apos;t set up for this Space yet, so only the dove works for now.</p>}
      <p className="tiny muted" style={{ marginTop: 6 }}>“Reconnect your Google account” alerts are always on, so things keep working.</p>
    </section>
  );
}
