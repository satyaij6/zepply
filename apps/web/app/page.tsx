import { Caveat, Instrument_Serif, Inter, Inter_Tight } from "next/font/google";
import LandingNavbar from "@/components/landing/LandingNavbar";
import LandingFooter from "@/components/landing/LandingFooter";
import Hero from "@/components/landing/home/Hero";
import Pillars from "@/components/landing/home/Pillars";
import HowItWorks from "@/components/landing/home/HowItWorks";
import Tools from "@/components/landing/home/Tools";
import UseCases from "@/components/landing/home/UseCases";
import Pricing from "@/components/landing/home/Pricing";
import Faq from "@/components/landing/home/Faq";
import FinalCta from "@/components/landing/home/FinalCta";

const inter = Inter({ subsets: ["latin"], variable: "--font-landing-body" });
const interTight = Inter_Tight({ subsets: ["latin"], variable: "--font-landing-display" });
const instrumentSerif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-landing-serif" });
const caveat = Caveat({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-landing-hand" });

export default function HomePage() {
  return (
    <div
      className={`${inter.variable} ${interTight.variable} ${instrumentSerif.variable} ${caveat.variable} landing-dark overflow-x-clip bg-night text-zinc-100 antialiased`}
      style={{ fontFamily: "var(--font-landing-body), sans-serif" }}
    >
      <LandingNavbar />
      <main>
        <Hero />
        <Pillars />
        <HowItWorks />
        <Tools />
        <UseCases />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
