import { Inter, Inter_Tight, Instrument_Serif } from "next/font/google";

// Same faces as the landing page, so sign-up feels like the next step of it (the font tokens read these variables)
const inter = Inter({ subsets: ["latin"], variable: "--font-landing-body" });
const interTight = Inter_Tight({ subsets: ["latin"], variable: "--font-landing-display" });
const instrumentSerif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-landing-serif" });

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${inter.variable} ${interTight.variable} ${instrumentSerif.variable} landing-dark text-zinc-100 antialiased`}
      style={{ fontFamily: "var(--font-landing-body), sans-serif" }}
    >
      {children}
    </div>
  );
}
