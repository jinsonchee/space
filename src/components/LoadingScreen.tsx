"use client";
import { useEffect, useState } from "react";
import { Pet } from "./Pixel";
import { ArtistLogo } from "./Photo";
import type { PetKind } from "@/lib/sprites";

/** "Welcome back rockstar" — shown once per browser session when the app opens. */
export function LoadingScreen({ logo, artist, pet }: { logo: string | null; artist: string; pet?: PetKind }) {
  const [show, setShow] = useState<boolean | null>(null);
  const [pct, setPct] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem("space_loaded") === "1"; } catch {}
    setShow(!seen);
    if (seen) return;
    const steps = [18, 42, 63, 81, 100];
    const timers = steps.map((p, i) => setTimeout(() => setPct(p), 220 + i * 330));
    timers.push(setTimeout(() => setDone(true), 2200));
    timers.push(setTimeout(() => { setShow(false); try { sessionStorage.setItem("space_loaded", "1"); } catch {} }, 2750));
    return () => timers.forEach(clearTimeout);
  }, []);

  if (!show) return null;
  const status = pct < 40 ? "Tuning the guitars…" : pct < 80 ? "Warming up the crowd…" : pct < 100 ? "Checking the mic…" : "You're on!";
  return (
    <div className={`loader ${done ? "done" : ""}`} role="status" aria-live="polite">
      <div className="loader-pet"><Pet kind={pet} size={64} /></div>
      <div className="loader-inner">
        <div className="loader-logo"><ArtistLogo src={logo} name={artist} height={96} /></div>
        <h1>Welcome back, rockstar</h1>
        <div className="xp" style={{ ["--segments" as string]: 16 }}>
          <span style={{ width: `${pct}%` }} />
        </div>
        <p className="small muted">{status}</p>
      </div>
    </div>
  );
}
