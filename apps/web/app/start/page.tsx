import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { onboardingState } from "@/lib/onboarding/state";
import { Wizard } from "@/components/onboarding/Wizard";

// Where everyone lands after signing in until onboarding is finished or skipped
export default async function StartPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signup");

  const state = await onboardingState(session.user.id).catch(() => null);
  if (!state) redirect("/login?error=account_missing");
  if (state.onboarded) redirect("/dashboard");

  const { error } = await searchParams;
  return <Wizard initial={state} connectError={error ?? null} />;
}
