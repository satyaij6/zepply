"use client";
import { useState } from "react";

interface CTAProps {
  email: string;
  setEmail: (v: string) => void;
  onJoin: (email?: string) => void;
  submitted: boolean;
  loading: boolean;
}

export default function CTASection({ onJoin, submitted, loading }: CTAProps) {
  const [localEmail, setLocalEmail] = useState("");

  return (
    <section style={{
      padding: "100px 24px",
      background: "linear-gradient(135deg, #1E1040 0%, #2D1B69 50%, #1E1040 100%)",
      textAlign: "center", position: "relative", overflow: "hidden",
    }}>
      {/* Glow orbs */}
      <div style={{ position: "absolute", top: -100, left: "20%", width: 400, height: 400, borderRadius: "50%", background: "rgba(124,111,255,0.15)", filter: "blur(80px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -100, right: "20%", width: 300, height: 300, borderRadius: "50%", background: "rgba(167,139,250,0.1)", filter: "blur(60px)", pointerEvents: "none" }} />

      <div style={{ maxWidth: 640, margin: "0 auto", position: "relative" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "6px 16px", borderRadius: 100,
          background: "rgba(124,111,255,0.2)", border: "1px solid rgba(124,111,255,0.4)",
          marginBottom: 28, fontSize: 13, fontWeight: 600, color: "#C4B5FD",
        }}>
          🚀 Early Access — Limited Spots
        </div>

        <h2 style={{
          fontSize: "clamp(28px, 5vw, 52px)", fontWeight: 900,
          color: "#fff", letterSpacing: "-1.5px", lineHeight: 1.15, marginBottom: 20,
        }}>
          Be the first to automate your Instagram growth
        </h2>

        <p style={{ fontSize: 17, color: "#A78BFA", lineHeight: 1.6, marginBottom: 44 }}>
          Join 500+ creators already on the waitlist. Get early access, locked-in pricing, and priority support.
        </p>

        {submitted ? (
          <div style={{
            padding: "24px 40px", borderRadius: 20,
            background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)",
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
            <p style={{ fontWeight: 700, fontSize: 20, color: "#4ADE80" }}>You&apos;re on the list!</p>
            <p style={{ fontSize: 15, color: "#86EFAC", marginTop: 6 }}>We&apos;ll email you as soon as Zepply launches.</p>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10, maxWidth: 480, margin: "0 auto", flexWrap: "wrap", justifyContent: "center" }}>
            <input
              type="email"
              placeholder="your@email.com"
              value={localEmail}
              onChange={e => setLocalEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && onJoin(localEmail)}
              style={{
                flex: 1, minWidth: 220, padding: "15px 20px", borderRadius: 12,
                border: "1.5px solid rgba(255,255,255,0.15)", fontSize: 15,
                background: "rgba(255,255,255,0.08)", color: "#fff",
                outline: "none", fontFamily: "inherit",
              }}
            />
            <button
              onClick={() => onJoin(localEmail)}
              disabled={loading}
              style={{
                padding: "15px 28px", borderRadius: 12, border: "none", cursor: "pointer",
                background: "linear-gradient(135deg, #7C6FFF, #6366F1)",
                color: "#fff", fontWeight: 700, fontSize: 15, fontFamily: "inherit",
                boxShadow: "0 4px 24px rgba(124,111,255,0.5)",
                transition: "all 0.2s ease", whiteSpace: "nowrap",
              }}
              onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-2px)")}
              onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
            >
              {loading ? "Joining..." : "Claim My Spot →"}
            </button>
          </div>
        )}

        <p style={{ fontSize: 13, color: "#7C6FFF", marginTop: 20 }}>No credit card required · Unsubscribe anytime</p>
      </div>
    </section>
  );
}
