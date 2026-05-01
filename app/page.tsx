"use client";

import { useState } from "react";
import LandingNavbar from "@/components/landing/LandingNavbar";
import HeroSection from "@/components/landing/HeroSection";
import TrustStrip from "@/components/landing/TrustStrip";
import PainSection from "@/components/landing/PainSection";
import HowItWorks from "@/components/landing/HowItWorks";
import UseCases from "@/components/landing/UseCases";
import FeaturesSection from "@/components/landing/FeaturesSection";
import ComparisonTable from "@/components/landing/ComparisonTable";
import CTASection from "@/components/landing/CTASection";
import FAQSection from "@/components/landing/FAQSection";
import LandingFooter from "@/components/landing/LandingFooter";

export default function HomePage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleJoin = async (emailOverride?: string) => {
    const target = emailOverride || email;
    if (!target.includes("@")) return;
    setLoading(true);
    try {
      await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: target }),
      });
      setSubmitted(true);
    } catch {
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  const scrollToCTA = () => {
    document.getElementById("cta-section")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div style={{ fontFamily: "'Poppins', sans-serif", background: "#ffffff", color: "#0d0d0d", overflowX: "hidden" }}>
      <LandingNavbar onJoinClick={scrollToCTA} />
      <HeroSection email={email} setEmail={setEmail} onJoin={handleJoin} submitted={submitted} loading={loading} />
      <TrustStrip />
      <PainSection />
      <HowItWorks />
      <UseCases />
      <FeaturesSection />
      <ComparisonTable />
      <div id="cta-section">
        <CTASection email={email} setEmail={setEmail} onJoin={handleJoin} submitted={submitted} loading={loading} />
      </div>
      <FAQSection />
      <LandingFooter />
    </div>
  );
}
