"use client";
import { useState } from "react";

const steps = [
  {
    num: 1, label: "Connect your Instagram",
    title: "One click. Officially connected.",
    desc: "Link your Instagram through Meta's official API — no developer needed. Takes 60 seconds and runs fully within Meta's approved guidelines.",
    bullets: ["Official Meta Business Partner integration", "No password sharing. No third-party access.", "Connect multiple accounts from one dashboard"],
    mockup: (
      <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: "#0F0F1A", marginBottom: 4 }}>Instagram Connected ✓</p>
        <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 14 }}>@yourhandle · 12,400 followers</p>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#FEF3C7", borderRadius: 8, padding: "6px 12px" }}>
          <span style={{ fontSize: 14 }}>🔥</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#92400E" }}>Meta Verified</span>
        </div>
      </div>
    ),
  },
  {
    num: 2, label: "Set your triggers",
    title: "Any comment. Any keyword. Any time.",
    desc: "Choose exactly what triggers a reply — a keyword in a comment, a story reply, a new follower DM. You set the rules once.",
    bullets: ["Keyword-based comment triggers", "Story reply automations", "New follower welcome DMs"],
    mockup: (
      <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Active Trigger</p>
        <div style={{ background: "#F4F4F8", borderRadius: 10, padding: "12px 16px", marginBottom: 10 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#0F0F1A" }}>If comment contains <span style={{ color: "#6366F1" }}>"link"</span></p>
          <p style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>→ Send DM with product link</p>
        </div>
        <div style={{ background: "#F4F4F8", borderRadius: 10, padding: "12px 16px" }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#0F0F1A" }}>If story reply received</p>
          <p style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>→ Start a sales conversation</p>
        </div>
      </div>
    ),
  },
  {
    num: 3, label: "AI handles the conversation",
    title: "Sounds like you. Works like a team.",
    desc: "Zepply uses AI to continue conversations naturally — answering follow-up questions and guiding leads to your offer.",
    bullets: ["Context-aware AI replies", "Trained on your tone & products", "Handles objections automatically"],
    mockup: (
      <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}>
        {[
          { bot: true, text: "Hey! Here's the link to my program 🎯" },
          { bot: false, text: "How long is it?" },
          { bot: true, text: "It's 8 weeks — perfect for beginners. Want to start today?" },
        ].map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.bot ? "flex-end" : "flex-start", marginBottom: 8 }}>
            <div style={{ background: m.bot ? "#6366F1" : "#F4F4F8", color: m.bot ? "#fff" : "#0F0F1A", borderRadius: 12, padding: "8px 12px", fontSize: 12, maxWidth: 180 }}>{m.text}</div>
          </div>
        ))}
      </div>
    ),
  },
  {
    num: 4, label: "Watch your numbers grow",
    title: "Every reply tracked. Every lead counted.",
    desc: "See exactly which posts drive the most DMs, which triggers convert, and how much revenue Zepply has attributed for you.",
    bullets: ["Revenue attribution per post", "Conversion rate by trigger", "Lead capture & export"],
    mockup: (
      <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>This week</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[["142", "Conversations"], ["23", "Leads captured"], ["₹1,840", "Revenue"], ["+34%", "vs last week"]].map(([v, l]) => (
            <div key={l} style={{ background: "#F4F4F8", borderRadius: 10, padding: "12px" }}>
              <p style={{ fontSize: 20, fontWeight: 800, color: "#0F0F1A" }}>{v}</p>
              <p style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>{l}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
];

export default function HowItWorks() {
  const [active, setActive] = useState(0);
  const s = steps[active];

  return (
    <section style={{ background: "#F4F4F8", padding: "80px 20px" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#6366F1", letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 16 }}>How Zepply works</p>
          <h2 style={{ fontSize: "clamp(28px,4.5vw,48px)", fontWeight: 900, color: "#0F0F1A", letterSpacing: "-1.5px", lineHeight: 1.2 }}>
            Four steps. Five minutes.<br />Then it runs itself.
          </h2>
          <p style={{ fontSize: 15, color: "#6B7280", marginTop: 14, maxWidth: 520, margin: "14px auto 0" }}>
            Follow these simple steps to automate your DMs, grow followers, and drive revenue effortlessly.
          </p>
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", justifyContent: "center", gap: 0, marginBottom: 24 }}>
          {steps.map((s, i) => (
            <button key={i} onClick={() => setActive(i)} style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
              padding: "12px 24px", background: "none", border: "none", cursor: "pointer",
              borderBottom: active === i ? "2px solid #6366F1" : "2px solid transparent",
              fontFamily: "inherit",
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: "50%",
                background: active === i ? "#6366F1" : "#E5E7EB",
                color: active === i ? "#fff" : "#9CA3AF",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700, transition: "all 0.2s",
              }}>{s.num}</div>
              <span style={{ fontSize: 13, fontWeight: 600, color: active === i ? "#6366F1" : "#6B7280", whiteSpace: "nowrap" }}>{s.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{
          background: "#fff", borderRadius: 20, padding: "40px",
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center",
          border: "1px solid #EBEBEB",
        }}>
          <div>
            <h3 style={{ fontSize: "clamp(22px,3vw,32px)", fontWeight: 800, color: "#0F0F1A", letterSpacing: "-0.8px", marginBottom: 14 }}>{s.title}</h3>
            <p style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.7, marginBottom: 24 }}>{s.desc}</p>
            <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {s.bullets.map(b => (
                <li key={b} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#6366F1", marginTop: 5, flexShrink: 0 }} />
                  <span style={{ fontSize: 14, color: "#374151" }}>{b}</span>
                </li>
              ))}
            </ul>
          </div>
          <div style={{ background: "#F4F4F8", borderRadius: 16, padding: 24 }}>{s.mockup}</div>
        </div>
      </div>
    </section>
  );
}
