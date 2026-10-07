import prisma from "@/lib/prisma";

/** Everything the onboarding wizard needs to resume where the person left off. */
export type OnboardingState = {
  step: number;
  path: string | null;
  languages: string[];
  name: string;
  niche: string | null;
  goals: string[];
  brandName: string;
  location: string;
  instagram: { username: string; profilePic: string | null; followers: number } | null;
  hasBrandKit: boolean;
  onboarded: boolean;
};

export async function onboardingState(userId: string): Promise<OnboardingState> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      name: true,
      path: true,
      languages: true,
      niche: true,
      goals: true,
      onboardingStep: true,
      onboardedAt: true,
      brandKit: { select: { brandName: true, location: true } },
      igAccounts: { where: { isActive: true }, select: { igUsername: true, igProfilePic: true, followerCount: true }, take: 1 },
    },
  });
  const ig = user.igAccounts[0];
  return {
    step: Math.max(1, user.onboardingStep),
    path: user.path,
    languages: user.languages,
    name: user.name ?? "",
    niche: user.niche,
    goals: user.goals,
    brandName: user.brandKit?.brandName ?? "",
    location: user.brandKit?.location ?? "",
    instagram: ig ? { username: ig.igUsername, profilePic: ig.igProfilePic, followers: ig.followerCount } : null,
    hasBrandKit: !!user.brandKit,
    onboarded: !!user.onboardedAt,
  };
}
