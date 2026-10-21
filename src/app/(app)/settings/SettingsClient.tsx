"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Settings } from "@/lib/db";
import type { UpdateInfo } from "@/lib/version";
import { updateSettings, setImage } from "../../actions/settings";
import { ACCENTS, inkFor } from "@/lib/color";
import { SpaceIcon } from "@/components/Logo";
import { ArtistLogo } from "@/components/Photo";

const TZS = ["Asia/Kuala_Lumpur", "Asia/Singapore", "Asia/Jakarta", "Asia/Bangkok", "Asia/Manila", "Asia/Hong_Kong", "Asia/Taipei", "Asia/Tokyo", "Asia/Seoul", "Australia/Sydney", "Europe/London", "America/New_York", "America/Los_Angeles"];

async function resize(file: File, max = 640): Promise<string> {
  if (file.type === "image/svg+xml") {
    return await new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(file); });
  }
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/webp", 0.86);
}

export default function SettingsClient({ settings, isMaster, update, email, repoUrl }: { settings: Settings; isMaster: boolean; update: UpdateInfo; email: boolean; repoUrl: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [f, setF] = useState({ artist_name: settings.artist_name, accent: settings.accent, timezone: settings.timezone });
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);

  const preview = (c: string) => {
    document.documentElement.style.setProperty("--accent", c);
    document.documentElement.style.setProperty("--accent-ink", inkFor(c));
  };
  const save = () => start(async () => {
    const r = await updateSettings(f);
    setMsg(r.ok ? { t: "Saved — your Space has been refreshed ✨" } : { t: r.error, bad: true });
    router.refresh();
  });
  const upload = (kind: "photo" | "logo", file: File | null) => start(async () => {
    const r = await setImage(kind, file ? await resize(file) : null);
    setMsg(r.ok ? { t: file ? "Image updated" : "Image removed" } : { t: r.error, bad: true });
    router.refresh();
  });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p className="muted">{isMaster ? "Make this Space yours." : "Only the artist (master account) can change these."}</p>
        </div>
      </div>

      <div className="grid g-2" style={{ alignItems: "start" }}>
        <section className="card">
          <h2 style={{ marginBottom: 16 }}>Branding</h2>
          <fieldset disabled={!isMaster} style={{ border: 0, padding: 0, margin: 0 }} className="col">
            <div className="field">
              <label className="label">Artist name</label>
              <input className="input" value={f.artist_name} onChange={(e) => setF({ ...f, artist_name: e.target.value })} />
              <div className="brand-mark" style={{ marginTop: 12 }}>
                <SpaceIcon style={{ width: 22, height: 22, color: "var(--accent)" }} />
                <span className="divider-v" />
                <ArtistLogo src={settings.logo} name={f.artist_name} height={26} />
              </div>
            </div>
            <div className="field" style={{ marginTop: 8 }}>
              <span className="label">Highlight colour</span>
              <div className="swatches">
                {ACCENTS.map((c) => (
                  <button key={c} type="button" className="swatch" style={{ background: c }} aria-pressed={f.accent === c} aria-label={c} onClick={() => { setF({ ...f, accent: c }); preview(c); }} />
                ))}
                <label className="swatch" style={{ background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)", position: "relative", overflow: "hidden" }} title="Custom colour">
                  <input type="color" value={f.accent} onChange={(e) => { setF({ ...f, accent: e.target.value }); preview(e.target.value); }} style={{ opacity: 0, position: "absolute", inset: 0 }} aria-label="Custom highlight colour" />
                </label>
              </div>
              <span className="tiny muted" style={{ marginTop: 6 }}>Everything else stays neutral, so one colour does all the talking.</span>
            </div>
            <div className="field" style={{ marginTop: 8 }}>
              <label className="label">Timezone (for reminders)</label>
              <select className="select" value={f.timezone} onChange={(e) => setF({ ...f, timezone: e.target.value })}>
                {[...new Set([f.timezone, ...TZS])].map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
              </select>
            </div>
            {msg && <p className="small" style={{ color: msg.bad ? "var(--danger)" : "var(--success)" }}>{msg.t}</p>}
            {isMaster && <button className="btn btn-accent" style={{ alignSelf: "flex-start", marginTop: 6 }} onClick={save} disabled={pending}>{pending ? "Saving…" : "Save branding"}</button>}
          </fieldset>
        </section>

        <div className="col" style={{ gap: 16 }}>
          <section className="card">
            <h2 style={{ marginBottom: 6 }}>Artist logo</h2>
            <p className="small muted" style={{ marginBottom: 16 }}>Shown in the sidebar, on the login screen and on the “Welcome back, rockstar” loading screen. A white logo on a transparent background works best (it flips dark automatically in light mode).</p>
            <div className="row" style={{ gap: 16 }}>
              <div style={{ width: 180, height: 96, borderRadius: 20, background: "var(--surface-2)", border: "1px solid var(--line)", display: "grid", placeItems: "center", padding: 12 }}>
                <ArtistLogo src={settings.logo} name={settings.artist_name} height={60} />
              </div>
              {isMaster && (
                <div className="col" style={{ gap: 6 }}>
                  <label className="btn btn-sm">Replace logo<input type="file" accept="image/png,image/webp,image/svg+xml" hidden onChange={(e) => upload("logo", e.target.files?.[0] ?? null)} /></label>
                  <button className="btn btn-sm btn-ghost" onClick={() => upload("logo", null)}>Reset to default</button>
                </div>
              )}
            </div>
            <button className="btn btn-sm btn-ghost" style={{ marginTop: 14 }} onClick={() => { try { sessionStorage.removeItem("space_loaded"); } catch {} location.reload(); }}>Preview loading screen</button>
          </section>

          <section className="card">
            <h2 style={{ marginBottom: 6 }}>App version</h2>
            <p className="small muted">You&apos;re on <strong style={{ color: "var(--text)" }}>v{update.current}</strong>{update.latest && !update.available && " — the latest. Nice."}</p>
            {update.available && (
              <div className="card card-tight" style={{ marginTop: 12, background: "var(--accent-soft)", borderColor: "transparent" }}>
                <strong>v{update.latest} is out 🎉</strong>
                {update.notes && <p className="small" style={{ marginTop: 4, whiteSpace: "pre-line" }}>{update.notes}</p>}
                <p className="small" style={{ marginTop: 8 }}>If auto-updates are on, it&apos;ll arrive on its own within a day. Want it now?</p>
                <ol className="small" style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                  <li>Open your Space repo on GitHub.</li>
                  <li>Click <strong>Sync fork</strong> → <strong>Update branch</strong>.</li>
                  <li>Your host rebuilds automatically and your data is upgraded on the way.</li>
                </ol>
              </div>
            )}
            <div className="divider" />
            <div className="row between small"><span className="muted">Email reminders</span><strong>{email ? "On" : "Off — add RESEND_API_KEY to turn on"}</strong></div>
          </section>
        </div>
      </div>
    </>
  );
}
