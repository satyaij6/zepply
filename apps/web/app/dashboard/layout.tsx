import { Instrument_Serif, Inter_Tight } from "next/font/google";
import { redirect } from "next/navigation";
import { DashboardProviders } from "@/components/layout/DashboardProviders";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// Same display and serif faces as the landing page (the font tokens read these variables)
const interTight = Inter_Tight({ subsets: ["latin"], variable: "--font-landing-display" });
const instrumentSerif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-landing-serif" });

export default async function DashboardRootLayout({ children }: { children: React.ReactNode }) {
  // New accounts set up their brand first (/start); "Skip for now" there also counts as done
  const session = await auth().catch(() => null);
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { onboardedAt: true } }).catch(() => null);
    if (user && !user.onboardedAt) redirect("/start");
  }

  return (
    <div className={`${interTight.variable} ${instrumentSerif.variable}`}>
      <DashboardProviders>{children}</DashboardProviders>
    </div>
  );
}
