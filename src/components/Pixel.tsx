"use client";
import { useEffect, useMemo, useState } from "react";
import type { AvatarConfig } from "@/lib/db";
import { PETS, type PetKind, DEFAULT_AVATAR, avatarRuns, AV_W, AV_H } from "@/lib/sprites";

type Run = [number, number, number, string];

function Runs({ runs, w, h, style, label }: { runs: Run[]; w: number; h: number; style?: React.CSSProperties; label?: string }) {
  return (
    <svg viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges" style={style} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {runs.map(([x, y, len, c], i) => (
        <rect key={i} x={x} y={y} width={len} height={1} fill={c} />
      ))}
    </svg>
  );
}

/** A retro pixel character. Blinks every few seconds so it feels alive. */
export function Avatar({ config, size = 160, still = false, label }: { config: AvatarConfig; size?: number; still?: boolean; label?: string }) {
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    if (still) return;
    let t: ReturnType<typeof setTimeout>;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const loop = () => {
      t = setTimeout(() => {
        setBlink(true);
        timers.push(setTimeout(() => setBlink(false), 140));
        if (Math.random() < 0.25) timers.push(setTimeout(() => { setBlink(true); timers.push(setTimeout(() => setBlink(false), 120)); }, 320));
        loop();
      }, 2400 + Math.random() * 2800);
    };
    loop();
    return () => { clearTimeout(t); timers.forEach(clearTimeout); };
  }, [still]);
  const open = useMemo(() => avatarRuns(config, false), [config]);
  const closed = useMemo(() => avatarRuns(config, true), [config]);
  return <Runs runs={blink ? closed : open} w={AV_W} h={AV_H} style={{ width: (size * AV_W) / AV_H, height: size, display: "block" }} label={label} />;
}

/** The pet mascot. Flying pets flap and hover; ground pets hop. */
export function Pet({ kind, size = 56 }: { kind?: PetKind; size?: number }) {
  const pet = PETS[kind ?? DEFAULT_AVATAR.pet] ?? PETS.dove;
  const [f, setF] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setF((x) => (x + 1) % pet.frames.length), pet.flying ? 260 : 900);
    return () => clearInterval(t);
  }, [pet]);
  return (
    <span className={`pet ${pet.flying ? "pet-fly" : "pet-hop"}`}>
      <Runs runs={pet.frames[f]} w={pet.w} h={pet.h} style={{ width: size, height: (size * pet.h) / pet.w, display: "block" }} label={pet.label} />
    </span>
  );
}

/** Character with its pet beside it (pet optional). */
export function Character({ config, size = 200, showPet = true, label }: { config: AvatarConfig; size?: number; showPet?: boolean; label?: string }) {
  const pet = PETS[(config.pet ?? DEFAULT_AVATAR.pet) as PetKind] ?? PETS.dove;
  return (
    <div className="character" style={{ width: showPet ? size * 1.25 : size * 0.8, height: size * 1.05 }}>
      <div className="character-shadow" style={{ width: size * 0.48 }} />
      <div className="character-body"><Avatar config={config} size={size} label={label} /></div>
      {showPet && (
        <div className={pet.flying ? "character-pet fly" : "character-pet ground"}>
          <Pet kind={config.pet} size={pet.flying ? size * 0.3 : size * 0.26} />
        </div>
      )}
    </div>
  );
}
