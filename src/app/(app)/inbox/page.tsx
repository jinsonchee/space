import { ComingSoon } from "@/components/ComingSoon";
import { requireMember } from "@/lib/auth";
import type { PetKind } from "@/lib/sprites";

export default async function Page() {
  const me = await requireMember();
  return (
    <ComingSoon
      pet={me.avatar.pet as PetKind}
      title="Inbox & Calendar"
      blurb="Your Gmail and Google Calendar, side by side."
      points={[
        "Read and send Gmail without leaving Space",
        "Google Calendar synced live — today's schedule up top",
        "Turn any email into a task in one tap",
        "Your pet flags new emails and upcoming events",
      ]}
    />
  );
}
