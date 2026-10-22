"use client";
import { useEffect, useState } from "react";
import { Pet } from "./Pixel";
import { ArtistLogo } from "./Photo";
import type { PetKind } from "@/lib/sprites";

// Runs before the first paint: if this session has already seen the loader, hide it instantly (no flash).
const SKIP = `try{if(sessionStorage.getItem("space_loaded")==="1")document.documentElement.setAttribute("data-loaded","")}catch(e){}`;

/**
 * "Welcome back rockstar" — shown once per browser session when the app opens.
 * It's part of the first HTML the server sends, so it covers the app from the very first frame
 * (before, it only appeared after the app had already flashed up).
 */
export function LoadingScreen({ logo, artist, pet }: { logo: string | null; artist: string; pet?: PetKind }) {
  const [show, setShow] = useState(true);
  const [pct, setPct] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem("space_loaded") === "1"; } catch {}
    setShow(!seen);
    if (seen) return;
    // About 1.2 seconds end to end: quick enough to open every time from the Home Screen.
    const steps = [24, 52, 78, 100];
    const timers = steps.map((p, i) => setTimeout(() => setPct(p), 80 + i * 180));
    timers.push(setTimeout(() => setDone(true), 900));
    timers.push(setTimeout(() => { setShow(false); try { sessionStorage.setItem("space_loaded", "1"); } catch {} }, 1200));
    return () => timers.forEach(clearTimeout);
  }, []);

  if (!show) return null;
  const status = pct < 40 ? "Tuning the guitars…" : pct < 80 ? "Warming up the crowd…" : pct < 100 ? "Checking the mic…" : "You're on!";
  return (
    <>
    <script dangerouslySetInnerHTML={{ __html: SKIP }} />
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
    </>
  );
}
