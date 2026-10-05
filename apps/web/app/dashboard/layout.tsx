import { Instrument_Serif, Inter_Tight } from "next/font/google";
import { DashboardProviders } from "@/components/layout/DashboardProviders";

// Same display and serif faces as the landing page (the font tokens read these variables)
const interTight = Inter_Tight({ subsets: ["latin"], variable: "--font-landing-display" });
const instrumentSerif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-landing-serif" });

export default function DashboardRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${interTight.variable} ${instrumentSerif.variable}`}>
      <DashboardProviders>{children}</DashboardProviders>
    </div>
  );
}
