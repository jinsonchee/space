import { ComingSoon } from "@/components/ComingSoon";
import { requireMember } from "@/lib/auth";
import type { PetKind } from "@/lib/sprites";

export default async function Page() {
  const me = await requireMember();
  return (
    <ComingSoon
      pet={me.avatar.pet as PetKind}
      title="Daily Trends"
      blurb="Top 10 content formats artists are winning with — refreshed every day."
      points={[
        "Top-performing videos tagged #singersongwriter #originalmusic #popmusic #indiemusic",
        "Ranked by views and engagement, refreshed every morning",
        "The format behind each one, broken down (hook, angle, edit style)",
        "A shoot concept for each trend, written for your sound",
      ]}
    />
  );
}
