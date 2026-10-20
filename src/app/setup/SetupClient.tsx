"use client";
import { useActionState, useState } from "react";
import { setupSpace } from "../actions/auth";
import { ACCENTS } from "@/lib/color";
import { SpaceIcon, SpaceWordmark } from "@/components/Logo";

export default function SetupClient() {
  const [state, action, pending] = useActionState(setupSpace, null);
  const [artist, setArtist] = useState("");
  const [accent, setAccent] = useState(ACCENTS[0]);
  return (
    <main className="auth" style={{ ["--accent" as string]: accent }}>
      <form action={action} className="card" style={{ width: "min(520px, 100%)", padding: 28 }}>
        <div className="row between" style={{ marginBottom: 18 }}>
          <div className="row">
            <SpaceIcon style={{ width: 30, height: 30, color: "var(--accent)" }} />
            <span className="brand-name" style={{ fontSize: 19 }}>
              {artist || "Your"}&apos;s <SpaceWordmark style={{ height: 14, width: "auto" }} />
            </span>
          </div>
        </div>
        <h1 style={{ fontSize: 30 }}>Let&apos;s set up your Space</h1>
        <p className="muted" style={{ margin: "8px 0 22px" }}>You&apos;ll be the master account — you can add your team after this.</p>

        <div className="col" style={{ gap: 14 }}>
          <div className="field"><label className="label">Setup code</label><input className="input" name="setupCode" required placeholder="From your deploy settings" /></div>
          <div className="grid g-2" style={{ gap: 12 }}>
            <div className="field"><label className="label">Artist name</label><input className="input" name="artist" required value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="LAYYI" /></div>
            <div className="field"><label className="label">Your name</label><input className="input" name="name" required placeholder="Your first name" /></div>
          </div>
          <div className="field"><label className="label">Email (used to log in)</label><input className="input" type="email" name="email" required placeholder="you@email.com" /></div>
          <div className="grid g-2" style={{ gap: 12 }}>
            <div className="field"><label className="label">6-digit PIN</label><input className="input" name="pin" inputMode="numeric" pattern="\d{6}" maxLength={6} required type="password" /></div>
            <div className="field"><label className="label">Confirm PIN</label><input className="input" name="pin2" inputMode="numeric" pattern="\d{6}" maxLength={6} required type="password" /></div>
          </div>
          <div className="field">
            <label className="label">Highlight colour</label>
            <div className="swatches">
              {ACCENTS.map((c) => (
                <button type="button" key={c} className="swatch" style={{ background: c }} aria-pressed={accent === c} onClick={() => setAccent(c)} aria-label={c} />
              ))}
            </div>
            <input type="hidden" name="accent" value={accent} />
          </div>
          {state && !state.ok && <p className="small" style={{ color: "var(--danger)" }}>{state.error}</p>}
          <button className="btn btn-accent" style={{ height: 48, marginTop: 6 }} disabled={pending}>{pending ? "Building your Space…" : "Launch my Space 🚀"}</button>
        </div>
      </form>
    </main>
  );
}
