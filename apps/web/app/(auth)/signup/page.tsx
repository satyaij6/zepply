import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import AuthScreen from "@/components/auth/AuthScreen";

export const metadata = { title: "Start free · Zepply" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const session = await auth();
  if (session?.user?.id && !error) redirect("/start");

  return <AuthScreen mode="signup" error={error} />;
}
