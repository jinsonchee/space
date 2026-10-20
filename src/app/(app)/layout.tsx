import { redirect } from "next/navigation";
import { getSettings, sql, type AvatarConfig } from "@/lib/db";
import { requireMember } from "@/lib/auth";
import { Shell } from "@/components/Shell";
import { LoadingScreen } from "@/components/LoadingScreen";
import { PetDock } from "@/components/PetDock";
import { DEFAULT_AVATAR, type PetKind } from "@/lib/sprites";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  if (!s) redirect("/setup");
  const me = await requireMember();
  // The artist's pet is the Space's mascot — it delivers everyone's notifications.
  const [artist] = await sql<{ avatar: AvatarConfig }[]>`select avatar from members where access = 'master' order by created_at limit 1`;
  const mascot = artist?.avatar ?? me.avatar;
  const pet = (mascot.pet ?? DEFAULT_AVATAR.pet) as PetKind;
  return (
    <>
      <LoadingScreen logo={s.logo} artist={s.artist_name} pet={pet} />
      <Shell artist={s.artist_name} logo={s.logo} me={{ name: me.name, role_label: me.role_label, photo: me.photo }}>
        {children}
      </Shell>
      <PetDock pet={pet} petName={mascot.petName || DEFAULT_AVATAR.petName} />
    </>
  );
}
