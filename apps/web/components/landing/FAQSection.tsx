"use client";
import { useState } from "react";

const faqs = [
  { q: "Is Zepply safe to use with my Instagram account?", a: "Yes, 100%. Zepply is built on top of Meta's official Instagram API. We never use bots, fake sessions, or third-party scraping. Your account is completely safe." },
  { q: "Will my followers know it's automated?", a: "Not unless you want them to. Your replies look completely natural. You write them — Zepply just sends them at the right time." },
  { q: "What type of Instagram account do I need?", a: "You need an Instagram Business or Creator account connected to a Facebook Page. Personal accounts are not supported by Meta's API." },
  { q: "When is Zepply launching?", a: "We're in private beta right now. Join the waitlist to get early access and be notified the moment we open up." },
  { q: "Will there be a free plan?", a: "Yes! Zepply will have a free forever plan with basic automation features. Power users can upgrade for unlimited replies and advanced features." },
  { q: "Can I automate DMs to people who comment?", a: "Absolutely. Zepply can send a DM automatically when someone comments a specific keyword — your product link, course info, booking page, anything." },
];

export default function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section style={{ padding: "96px 24px", background: "#F9F9F9" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#7C6FFF", letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>
            FAQ
          </p>
          <h2 style={{ fontSize: "clamp(26px, 4vw, 40px)", fontWeight: 800, letterSpacing: "-1px", color: "#0A0A0A" }}>
            Frequently asked questions
          </h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {faqs.map(({ q, a }, i) => (
            <div key={i} style={{
              borderRadius: 16, border: "1px solid #EBEBEB",
              background: "#fff", overflow: "hidden",
              boxShadow: open === i ? "0 4px 20px rgba(124,111,255,0.1)" : "none",
              transition: "box-shadow 0.2s",
            }}>
              <button
                onClick={() => setOpen(open === i ? null : i)}
                style={{
                  width: "100%", padding: "20px 24px", display: "flex",
                  justifyContent: "space-between", alignItems: "center",
                  background: "transparent", border: "none", cursor: "pointer",
                  textAlign: "left", fontFamily: "inherit",
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 600, color: "#0A0A0A", lineHeight: 1.4 }}>{q}</span>
                <span style={{
                  flexShrink: 0, marginLeft: 16, fontSize: 20, color: "#7C6FFF",
                  transition: "transform 0.2s", transform: open === i ? "rotate(45deg)" : "rotate(0deg)",
                  display: "inline-block",
                }}>+</span>
              </button>
              {open === i && (
                <div style={{ padding: "0 24px 20px", fontSize: 14, color: "#6B7280", lineHeight: 1.7 }}>
                  {a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
