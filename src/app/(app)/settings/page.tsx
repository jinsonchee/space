import { requireMember } from "@/lib/auth";
import { getSettings } from "@/lib/db";
import { checkForUpdate } from "@/lib/version";
import { emailEnabled } from "@/lib/notify";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const me = await requireMember();
  const [s, update] = await Promise.all([getSettings(), checkForUpdate()]);
  return (
    <SettingsClient
      settings={s!}
      isMaster={me.access === "master"}
      update={update}
      email={emailEnabled()}
      repoUrl={process.env.UPDATE_REPO_URL ?? null}
    />
  );
}
