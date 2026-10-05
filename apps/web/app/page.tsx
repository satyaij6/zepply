import dynamic from "next/dynamic";
import LandingNavbar from "@/components/landing/LandingNavbar";
import WaitlistHero from "@/components/landing/WaitlistHero";
import TrustStrip from "@/components/landing/TrustStrip";
import PainSection from "@/components/landing/PainSection";
import UseCases from "@/components/landing/UseCases";
import FeaturesSection from "@/components/landing/FeaturesSection";
import ComparisonTable from "@/components/landing/ComparisonTable";
import LandingFooter from "@/components/landing/LandingFooter";

const HowItWorks = dynamic(() => import("@/components/landing/HowItWorks"));
const FAQSection = dynamic(() => import("@/components/landing/FAQSection"));
const WaitlistCTA = dynamic(() => import("@/components/landing/WaitlistCTA"));

export default function HomePage() {
  return (
    <div style={{ fontFamily: "'Poppins', sans-serif", background: "#ffffff", color: "#0d0d0d", overflowX: "hidden" }}>
      <LandingNavbar />
      <WaitlistHero />
      <TrustStrip />
      <PainSection />
      <HowItWorks />
      <UseCases />
      <FeaturesSection />
      <ComparisonTable />
      <div id="cta-section">
        <WaitlistCTA />
      </div>
      <FAQSection />
      <LandingFooter />
    </div>
  );
}
