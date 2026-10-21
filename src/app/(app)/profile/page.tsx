import { requireMember } from "@/lib/auth";
import { calendarConfigured, getConnection } from "@/lib/google";
import ProfileClient from "./ProfileClient";

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const me = await requireMember();
  const conn = await getConnection(me.id);
  const google = { configured: calendarConfigured(), email: conn?.google_email ?? null, status: conn?.status ?? null, features: conn?.features ?? [], canMarkRead: conn?.canMarkRead ?? false };
  const { google: result } = await searchParams;
  return <ProfileClient me={JSON.parse(JSON.stringify(me))} google={google} googleResult={result ?? null} />;
}
