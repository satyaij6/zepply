import { Caveat, Inter, Inter_Tight, Instrument_Serif, Playfair_Display, Plus_Jakarta_Sans, Poppins } from "next/font/google";

// The dashboard's faces (Inter, Inter Tight, Instrument Serif, Caveat for handwritten notes)
// plus the headline faces offered in the brand kit, so the font picker shows each for real
const inter = Inter({ subsets: ["latin"], variable: "--font-landing-body" });
const interTight = Inter_Tight({ subsets: ["latin"], variable: "--font-landing-display" });
const instrumentSerif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-landing-serif" });
const caveat = Caveat({ subsets: ["latin"], weight: ["500"], variable: "--font-landing-hand" });
const brandInterTight = Inter_Tight({ subsets: ["latin"], weight: "700", variable: "--font-brand-inter-tight" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], weight: "700", variable: "--font-brand-jakarta" });
const poppins = Poppins({ subsets: ["latin"], weight: "700", variable: "--font-brand-poppins" });
const playfair = Playfair_Display({ subsets: ["latin"], weight: "700", variable: "--font-brand-playfair" });

export const metadata = { title: "Set up Zepply" };

export default function StartLayout({ children }: { children: React.ReactNode }) {
  const fonts = [inter, interTight, instrumentSerif, caveat, brandInterTight, jakarta, poppins, playfair].map((f) => f.variable).join(" ");
  return (
    <div className={`${fonts} min-h-dvh bg-app-bg text-app-ink antialiased`} style={{ fontFamily: "var(--font-landing-body), sans-serif" }}>
      {children}
    </div>
  );
}
