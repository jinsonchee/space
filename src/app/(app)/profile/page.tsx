import { requireMember } from "@/lib/auth";
import { sql } from "@/lib/db";
import { calendarConfigured, getConnection } from "@/lib/google";
import { emailEnabled } from "@/lib/notify";
import type { NotifyPrefs } from "@/lib/notify-prefs";
import ProfileClient from "./ProfileClient";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const me = await requireMember();
  const [conn, [sig]] = await Promise.all([getConnection(me.id), sql<{ email_signature: string; notify_prefs: NotifyPrefs }[]>`select email_signature, notify_prefs from members where id = ${me.id}`]);
  const google = { configured: calendarConfigured(), email: conn?.google_email ?? null, status: conn?.status ?? null, features: conn?.features ?? [], canMarkRead: conn?.canMarkRead ?? false, signature: sig?.email_signature ?? "" };
  const { google: result } = await searchParams;
  return <ProfileClient me={JSON.parse(JSON.stringify(me))} google={google} googleResult={result ?? null} notify={{ prefs: sig?.notify_prefs ?? {}, emailOn: emailEnabled() }} />;
}
