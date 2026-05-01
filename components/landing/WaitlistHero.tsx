"use client";
import { useState } from "react";
import HeroSection from "./HeroSection";

export default function WaitlistHero() {
  const [localEmail, setLocalEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleJoin = async (emailOverride?: string) => {
    const target = emailOverride || localEmail;
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

  return (
    <HeroSection
      email={localEmail}
      setEmail={setLocalEmail}
      onJoin={handleJoin}
      submitted={submitted}
      loading={loading}
    />
  );
}
