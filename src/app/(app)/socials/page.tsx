import { ComingSoon } from "@/components/ComingSoon";
import { requireMember } from "@/lib/auth";
import type { PetKind } from "@/lib/sprites";

export default async function Page() {
  const me = await requireMember();
  return (
    <ComingSoon
      pet={me.avatar.pet as PetKind}
      title="Post Stats"
      blurb="How every post is doing, across every platform."
      points={[
        "YouTube, Instagram, TikTok and Facebook posts in one feed",
        "Views, likes, comments, shares and saves per post",
        "Your best posts this week, at a glance",
        "Follower stats on Home update themselves (no more manual entry)",
      ]}
    />
  );
}
