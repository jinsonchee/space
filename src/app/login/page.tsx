import { redirect } from "next/navigation";
import { sql, getSettings } from "@/lib/db";
import { currentMember, rememberedMemberId } from "@/lib/auth";
import LoginClient from "./LoginClient";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from members`;
  if (n === 0) redirect("/setup");
  if (await currentMember()) redirect("/");
  const s = await getSettings();
  const rid = await rememberedMemberId();
  let remembered: { id: string; name: string; photo: string | null } | null = null;
  if (rid && /^[0-9a-f-]{36}$/.test(rid)) {
    const rows = await sql<{ id: string; name: string; photo: string | null }[]>`select id, name, photo from members where id = ${rid}`;
    remembered = rows[0] ?? null;
  }
  return <LoginClient artist={s?.artist_name ?? "Your"} logo={s?.logo ?? null} remembered={remembered} />;
}
