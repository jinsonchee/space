"use client";
import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { findMember, loginWithPin, notMe, type PublicMember } from "../actions/auth";
import { PinPad } from "@/components/PinPad";
import { Photo, ArtistLogo } from "@/components/Photo";
import { SpaceIcon } from "@/components/Logo";

export default function LoginClient({ artist, logo, remembered }: { artist: string; logo: string | null; remembered: PublicMember | null }) {
  const router = useRouter();
  const [member, setMember] = useState<PublicMember | null>(remembered);
  const [err, setErr] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const [findState, findAction, finding] = useActionState(async (prev: unknown, fd: FormData) => {
    const r = await findMember(prev, fd);
    if (r.ok) setMember(r.member);
    return r;
  }, null);

  const submitPin = (pin: string) =>
    start(async () => {
      setErr(null);
      const r = await loginWithPin(member!.id, pin);
      if (r.ok) {
        try { sessionStorage.removeItem("space_loaded"); } catch {}
        router.replace("/");
        router.refresh();
      } else setErr(r.error);
    });

  return (
    <main className="auth">
      <div className="auth-card">
        <ArtistLogo src={logo} name={artist} height={72} />

        {member ? (
          <>
            <Photo src={member.photo} name={member.name} size={96} ring />
            <div>
              <h2>Hey {member.name.split(" ")[0]}!</h2>
              <p className="muted" style={{ marginTop: 6 }}>Enter your 6-digit PIN</p>
            </div>
            <PinPad onComplete={submitPin} busy={busy} error={err} />
            <p className="small" style={{ minHeight: 20, color: err ? "var(--danger)" : "var(--muted)" }}>{busy ? "Checking…" : err ?? " "}</p>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                if (remembered && member.id === remembered.id) start(() => notMe());
                else setMember(null);
              }}
            >
              Not {member.name.split(" ")[0]}? Switch account
            </button>
          </>
        ) : (
          <form action={findAction} className="col" style={{ width: "100%", gap: 14, marginTop: 10 }}>
            <div>
              <h1 style={{ fontSize: 32 }}>Who&apos;s jamming today?</h1>
              <p className="muted" style={{ marginTop: 8 }}>Enter the email or phone number your Space admin added you with.</p>
            </div>
            <input className="input" name="who" placeholder="you@email.com or +60 12…" autoComplete="username" autoFocus style={{ height: 48, textAlign: "center" }} />
            {findState && !findState.ok && <p className="small" style={{ color: "var(--danger)" }}>{findState.error}</p>}
            <button className="btn btn-accent" style={{ height: 48 }} disabled={finding}>{finding ? "Looking…" : "Continue"}</button>
          </form>
        )}
        <div className="row tiny faint" style={{ gap: 6, marginTop: 8 }}>
          <SpaceIcon style={{ width: 14, height: 14 }} /> Powered by Space
        </div>
      </div>
    </main>
  );
}
