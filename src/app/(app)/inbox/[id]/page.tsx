import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { getSettings, sql } from "@/lib/db";
import { getLabels, getThread, gmailLink, markThreadRead } from "@/lib/gmail";
import { getMembersLite, getLabels as getTaskLabels, getGoalsLite } from "@/lib/queries";
import { whenFull } from "@/lib/when";
import { I } from "@/components/Icons";
import ThreadClient from "./ThreadClient";

export const dynamic = "force-dynamic";

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireMember();
  const { id } = await params;
  const [s, r, members, taskLabels, goals, mail, [sig]] = await Promise.all([
    getSettings(), getThread(me.id, id), getMembersLite(), getTaskLabels(), getGoalsLite(), getLabels(me.id),
    sql<{ email_signature: string }[]>`select email_signature from members where id = ${me.id}`,
  ]);
  if (r.state !== "ok") {
    return (
      <>
        <div className="page-head"><Link href="/inbox" className="btn btn-sm btn-ghost"><I.left style={{ width: 16 }} /> Inbox</Link></div>
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
      threadLabels={r.labels}
      mailLabels={mail.labels}
      account={r.account}
      gmailUrl={gmailLink(id, r.account)}
      signature={sig?.email_signature ?? ""}
      members={members}
      labels={taskLabels}
      goals={goals}
      meId={me.id}
    />
  );
}
