"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPhoto } from "@/app/actions/members";
import { Photo } from "./Photo";

async function squareResize(file: File, size = 320) {
  const bmp = await createImageBitmap(file);
  const s = Math.min(bmp.width, bmp.height);
  const c = document.createElement("canvas");
  c.width = c.height = size;
  c.getContext("2d")!.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, size, size);
  return c.toDataURL("image/jpeg", 0.85);
}

export function PhotoUpload({ memberId, name, src }: { memberId: string; name: string; src: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const change = (file: File | null) =>
    start(async () => {
      const r = await setPhoto(memberId, file ? await squareResize(file) : null);
      if (!r.ok) setErr(r.error); else { setErr(null); router.refresh(); }
    });
  return (
    <div className="row" style={{ gap: 14 }}>
      <Photo src={src} name={name} size={64} />
      <div className="col" style={{ gap: 6 }}>
        <div className="row" style={{ gap: 6 }}>
          <label className="btn btn-sm" aria-disabled={pending}>
            {pending ? "Uploading…" : src ? "Change photo" : "Upload photo"}
            <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => change(e.target.files?.[0] ?? null)} />
          </label>
          {src && <button className="btn btn-sm btn-ghost" onClick={() => change(null)} disabled={pending}>Remove</button>}
        </div>
        <span className="tiny muted">{err ?? "Shown in the sidebar, tasks and team list."}</span>
      </div>
    </div>
  );
}
