"use client";
import { useState, useTransition } from "react";
import type { Member } from "@/lib/db";
import { MemberForm } from "@/components/MemberForm";
import { PhotoUpload } from "@/components/PhotoUpload";
import { changeMyPin, setTheme } from "../../actions/members";
import { logout } from "../../actions/auth";
import { I } from "@/components/Icons";
import { CalendarCard, type CalendarInfo } from "./CalendarCard";

export default function ProfileClient({ me, calendar, calendarResult }: { me: Member; calendar: CalendarInfo; calendarResult: string | null }) {
  const [pending, start] = useTransition();
  const [pins, setPins] = useState({ cur: "", next: "", again: "" });
  const [pinMsg, setPinMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const [theme, setT] = useState(me.theme);

  const flipTheme = (t: "light" | "dark") => {
    setT(t);
    document.documentElement.dataset.theme = t;
    start(() => setTheme(t));
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>My profile</h1>
          <p className="muted">{me.role_label} · {me.access === "master" ? "Master" : me.access === "admin" ? "Admin" : "Member"}</p>
        </div>
        <form action={logout}><button className="btn"><I.logout style={{ width: 16 }} /> Log out</button></form>
      </div>

      <div className="col" style={{ gap: 16 }}>
        <section className="card">
          <h2 style={{ marginBottom: 16 }}>Photo</h2>
          <PhotoUpload memberId={me.id} name={me.name} src={me.photo} />
        </section>

        <div className="grid g-2" style={{ alignItems: "start" }}>
          <section className="card">
            <h2 style={{ marginBottom: 16 }}>Details</h2>
            <MemberForm member={me} viewer={{ id: me.id, access: me.access }} />
          </section>

          <div className="col" style={{ gap: 16 }}>
            <CalendarCard info={calendar} result={calendarResult} />

            <section className="card">
              <h2 style={{ marginBottom: 14 }}>Appearance</h2>
              <div className="seg">
                <button aria-pressed={theme === "dark"} onClick={() => flipTheme("dark")}><I.moon style={{ width: 14, verticalAlign: -2 }} /> Dark</button>
                <button aria-pressed={theme === "light"} onClick={() => flipTheme("light")}><I.sun style={{ width: 14, verticalAlign: -2 }} /> Light</button>
              </div>
              <p className="tiny muted" style={{ marginTop: 10 }}>The highlight colour is set by the artist for the whole Space.</p>
            </section>

            <section className="card">
              <h2 style={{ marginBottom: 14 }}>Change PIN</h2>
              <form className="col" style={{ gap: 10 }} onSubmit={(e) => {
                e.preventDefault();
                if (pins.next !== pins.again) return setPinMsg({ t: "New PINs don't match.", bad: true });
                start(async () => {
                  const r = await changeMyPin(pins.cur, pins.next);
                  setPinMsg(r.ok ? { t: "PIN updated 🔐" } : { t: r.error, bad: true });
                  if (r.ok) setPins({ cur: "", next: "", again: "" });
                });
              }}>
                {(["cur", "next", "again"] as const).map((k) => (
                  <input key={k} className="input" type="password" inputMode="numeric" maxLength={6} pattern="\d{6}" required
                    placeholder={k === "cur" ? "Current PIN" : k === "next" ? "New 6-digit PIN" : "Repeat new PIN"}
                    value={pins[k]} onChange={(e) => setPins({ ...pins, [k]: e.target.value.replace(/\D/g, "") })} />
                ))}
                {pinMsg && <p className="small" style={{ color: pinMsg.bad ? "var(--danger)" : "var(--success)" }}>{pinMsg.t}</p>}
                <button className="btn" disabled={pending}>Update PIN</button>
              </form>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
