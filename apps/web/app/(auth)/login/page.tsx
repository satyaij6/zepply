import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import AuthScreen from "@/components/auth/AuthScreen";

export const metadata = { title: "Log in · Zepply" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const session = await auth();
  if (session?.user?.id && !error) redirect("/start");

  return <AuthScreen mode="login" error={error} />;
}
