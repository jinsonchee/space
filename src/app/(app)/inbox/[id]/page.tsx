import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { getSettings } from "@/lib/db";
import { getThread, gmailLink, markThreadRead } from "@/lib/gmail";
import { getMembersLite, getLabels, getGoalsLite } from "@/lib/queries";
import { whenFull } from "@/lib/when";
import { I } from "@/components/Icons";
import ThreadClient from "./ThreadClient";

export const dynamic = "force-dynamic";

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireMember();
  const { id } = await params;
  const [s, r, members, labels, goals] = await Promise.all([getSettings(), getThread(me.id, id), getMembersLite(), getLabels(), getGoalsLite()]);
  const back = <Link href="/inbox" className="btn btn-sm btn-ghost"><I.left style={{ width: 16 }} /> Inbox</Link>;
  if (r.state !== "ok") {
    return (
      <>
        <div className="page-head">{back}</div>
        <div className="card empty">
          <p>{r.state === "expired" ? "Your Google connection expired." : r.state === "off" ? "Gmail isn't connected." : "Couldn't open this email just now."}</p>
          {r.state !== "error" && <a className="btn btn-accent" style={{ marginTop: 12 }} href="/api/google/connect?want=gmail">{r.state === "expired" ? "Reconnect" : "Connect Gmail"}</a>}
        </div>
      </>
    );
  }
  // Opening a conversation in Space marks it read in Gmail too (like opening it in Gmail).
  if (r.messages.some((m) => m.unread)) await markThreadRead(me.id, id);
  const messages = r.messages.map((m) => ({ ...m, when: whenFull(m.date, s!.timezone) }));
  return (
    <ThreadClient
      threadId={id}
      subject={r.subject}
      messages={messages}
      account={r.account}
      gmailUrl={gmailLink(id, r.account)}
      members={members}
      labels={labels}
      goals={goals}
      meId={me.id}
    />
  );
}
