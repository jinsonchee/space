import { requireMember } from "@/lib/auth";
import { calendarConfigured, getConnection } from "@/lib/google";
import ProfileClient from "./ProfileClient";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ calendar?: string }> }) {
  const me = await requireMember();
  const conn = await getConnection(me.id);
  const calendar = { configured: calendarConfigured(), email: conn?.google_email ?? null, status: conn?.status ?? null };
  const { calendar: result } = await searchParams;
  return <ProfileClient me={JSON.parse(JSON.stringify(me))} calendar={calendar} calendarResult={result ?? null} />;
}
