"use client";
import { useState } from "react";
import CTASection from "./CTASection";

export default function WaitlistCTA() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleJoin = async (emailOverride?: string) => {
    if (!emailOverride?.includes("@")) return;
    setLoading(true);
    try {
      await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailOverride }),
      });
      setSubmitted(true);
    } catch {
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <CTASection
      email=""
      setEmail={() => {}}
      onJoin={handleJoin}
      submitted={submitted}
      loading={loading}
    />
  );
}
