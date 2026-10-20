import { requireMember } from "@/lib/auth";
import ProfileClient from "./ProfileClient";

export default async function ProfilePage() {
  const me = await requireMember();
  return <ProfileClient me={JSON.parse(JSON.stringify(me))} />;
}
