import { Caveat, Inter, Inter_Tight, Instrument_Serif } from "next/font/google";

// The dashboard's faces (Inter, Inter Tight, Instrument Serif, Caveat for handwritten notes), loaded
// exactly as the landing page loads them
const inter = Inter({ subsets: ["latin"], variable: "--font-landing-body" });
const interTight = Inter_Tight({ subsets: ["latin"], variable: "--font-landing-display" });
const instrumentSerif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-landing-serif" });
const caveat = Caveat({ subsets: ["latin"], weight: ["500"], variable: "--font-landing-hand" });

// The other headline faces offered in the brand kit, only so the font picker can show each one.
// A plain stylesheet: next/font's build step failed on Vercel with these (Turbopack: "next/font/google
// queries have exactly one entry"), and the picker doesn't need them self-hosted.
const BRAND_FONTS =
  "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700&family=Poppins:wght@700&family=Playfair+Display:wght@700&display=swap";

export const metadata = { title: "Set up Zepply" };

export default function StartLayout({ children }: { children: React.ReactNode }) {
  const fonts = [inter, interTight, instrumentSerif, caveat].map((f) => f.variable).join(" ");
  return (
    <div className={`${fonts} min-h-dvh bg-app-bg text-app-ink antialiased`} style={{ fontFamily: "var(--font-landing-body), sans-serif" }}>
      <link rel="stylesheet" href={BRAND_FONTS} precedence="default" />
      {children}
    </div>
  );
}
