"use client";
import { useEffect, useState } from "react";

/** 6-digit PIN entry: on-screen keypad + physical keyboard. Calls onComplete when 6 digits are in. */
export function PinPad({ onComplete, busy, error }: { onComplete: (pin: string) => void; busy?: boolean; error?: string | null }) {
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (error) {
      setShake(true);
      setPin("");
      const t = setTimeout(() => setShake(false), 450);
      return () => clearTimeout(t);
    }
  }, [error]);

  const press = (d: string) => {
    if (busy) return;
    setPin((p) => {
      if (p.length >= 6) return p;
      const next = p + d;
      if (next.length === 6) setTimeout(() => onComplete(next), 120);
      return next;
    });
  };
  const back = () => setPin((p) => p.slice(0, -1));

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") back();
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  return (
    <div className="col" style={{ alignItems: "center", gap: 22 }}>
      <div className={`pin-dots ${shake ? "shake" : ""}`} aria-label={`${pin.length} of 6 digits entered`}>
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className={i < pin.length ? "on" : ""} />
        ))}
      </div>
      <div className="keypad">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} type="button" onClick={() => press(d)}>{d}</button>
        ))}
        <span />
        <button type="button" onClick={() => press("0")}>0</button>
        <button type="button" onClick={back} aria-label="Delete" style={{ fontSize: 18 }}>⌫</button>
      </div>
    </div>
  );
}
