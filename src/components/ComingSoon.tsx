import { Pet } from "./Pixel";
import type { PetKind } from "@/lib/sprites";

export function ComingSoon({ title, blurb, points, pet }: { title: string; blurb: string; points: string[]; pet?: PetKind }) {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          <p className="muted">{blurb}</p>
        </div>
        <span className="chip chip-accent">Phase 2 · in the studio</span>
      </div>
      <div className="card soon-hero">
        <Pet kind={pet} size={84} />
        <h2>Still mixing this one 🎛️</h2>
        <p className="muted" style={{ maxWidth: 460 }}>Here&apos;s what&apos;s coming to this page in the next update — it&apos;ll appear here automatically once your Space updates.</p>
        <ul className="list-plain col" style={{ gap: 8, marginTop: 6, textAlign: "left" }}>
          {points.map((p) => <li key={p} className="row" style={{ gap: 10, alignItems: "flex-start" }}><span style={{ color: "var(--accent)", fontWeight: 800 }}>✦</span><span>{p}</span></li>)}
        </ul>
      </div>
    </>
  );
}
