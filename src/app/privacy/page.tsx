import Link from "next/link";
import { getSettings } from "@/lib/db";

export const dynamic = "force-dynamic";

// Public privacy policy (no login needed) — Google requires one before a calendar app can go to production.
export default async function PrivacyPage() {
  const s = await getSettings().catch(() => null);
  const space = s ? `${s.artist_name}'s Space` : "This Space";
  return (
    <main className="auth" style={{ placeItems: "start center" }}>
      <article className="card" style={{ width: "min(720px, 100%)", padding: 28, lineHeight: 1.6 }}>
        <span className="eyebrow">Privacy policy</span>
        <h1 style={{ fontSize: 28, margin: "6px 0 14px" }}>{space}</h1>
        <p className="muted">{space} is a private workspace for an artist and their team. Only people the artist invites can log in. It is run by the artist on their own accounts; no one else, including the people who make the Space software, has access to its data.</p>

        <h2 style={{ fontSize: 18, marginTop: 22 }}>What we keep</h2>
        <p>Your name, email, role, photo and a scrambled (hashed) version of your PIN, plus the tasks, goals, to-dos and notifications your team creates. This is stored in the artist&apos;s own database and used only to run the Space.</p>

        <h2 style={{ fontSize: 18, marginTop: 22 }}>Google Calendar (optional)</h2>
        <p>If you choose <strong>Connect Google Calendar</strong>, the Space asks Google for read-only access to the events on your main calendar and your Google email address. It uses them only to show your events on your Home and My Week pages.</p>
        <ul>
          <li>Events are read from Google when you open those pages. They are <strong>not saved</strong> in the database.</li>
          <li>The Space can never create, change or delete anything in your calendar.</li>
          <li>The access keys Google provides are encrypted before they are stored in the artist&apos;s database.</li>
          <li>Your calendar data is never sold, shared with anyone else, used for advertising, or used to train AI models.</li>
          <li>You can disconnect at any time from <strong>My profile → Google Calendar → Disconnect</strong>, which deletes the keys and tells Google to revoke access. You can also remove access at <a href="https://myaccount.google.com/permissions" style={{ textDecoration: "underline" }}>myaccount.google.com/permissions</a>.</li>
        </ul>
        <p>The Space&apos;s use of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy" style={{ textDecoration: "underline" }}>Google API Services User Data Policy</a>, including the Limited Use requirements.</p>

        <h2 style={{ fontSize: 18, marginTop: 22 }}>Emails</h2>
        <p>If the artist turns on email reminders, the Space sends task and weekly reminders to your email address.</p>

        <h2 style={{ fontSize: 18, marginTop: 22 }}>Removing your data</h2>
        <p>Ask the artist or an admin of the Space to remove you; this deletes your account and everything linked to it. For any privacy question, contact the artist&apos;s team.</p>

        <p className="small muted" style={{ marginTop: 24 }}><Link href="/login" style={{ textDecoration: "underline" }}>Go to {space}</Link></p>
      </article>
    </main>
  );
}
