"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

interface HeroProps {
  email: string;
  setEmail: (v: string) => void;
  onJoin: (email?: string) => void;
  submitted: boolean;
  loading: boolean;
}

const BUBBLES = [
  { id: 1, type: "bot", src: "/chat-bubble-1.png", alt: "Here's your 30-day home workout plan", width: 240, height: 110, mr: 0 },
  { id: 2, type: "user", src: "/user-bubble-1.png", alt: "Looks good. Do you have more plans?", width: 240, height: 80, mr: 140 },
  { id: 3, type: "bot", src: "/chat-bubble-2.png", alt: "Yes! I have 8-week fat loss and muscle gain programs", width: 240, height: 100, mr: 0 },
  { id: 4, type: "user", src: "/user-bubble-2.png", alt: "Sure, show me", width: 240, height: 60, mr: 140 },
  { id: 5, type: "bot", src: "/chat-bubble-3.png", alt: "Here are my popular programs", width: 240, height: 110, mr: 0 },
  { id: 6, type: "user", src: "/user-bubble-3.png", alt: "I need this plan!", width: 240, height: 60, mr: 140 },
];

export default function HeroSection({ onJoin, submitted, loading }: HeroProps) {
  const [localEmail, setLocalEmail] = useState("");

  // Chat animation state
  const [visibleCount, setVisibleCount] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    if (isFadingOut) {
      const timer = setTimeout(() => {
        setVisibleCount(0);
        setIsFadingOut(false);
      }, 800); // Time to wait for fade out animation to finish before resetting
      return () => clearTimeout(timer);
    }

    if (visibleCount < BUBBLES.length) {
      const timer = setTimeout(() => {
        setVisibleCount(prev => prev + 1);
      }, visibleCount === 0 ? 500 : 1600); // 500ms for first bubble, then 1.6s between bubbles
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        setIsFadingOut(true);
      }, 4000); // Wait 4 seconds after the last bubble appears before fading out
      return () => clearTimeout(timer);
    }
  }, [visibleCount, isFadingOut]);

  return (
    <section style={{
      position: "relative",
      minHeight: "100vh",
      backgroundImage: "url('/hero-bg.png')",
      backgroundSize: "cover",
      backgroundPosition: "center top",
      backgroundRepeat: "no-repeat",
      overflow: "hidden",
    }}>
      {/* subtle left gradient for text legibility */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: "linear-gradient(105deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.10) 45%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{
        position: "relative",
        zIndex: 1,
        maxWidth: 1240,
        margin: "0 auto",
        padding: "110px 48px 60px",
        display: "grid",
        gridTemplateColumns: "58% 42%",
        gap: 24,
        minHeight: "100vh",
        alignItems: "center",
      }}>

        {/* ── LEFT: Content ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <h1 style={{
            fontFamily: "'Kufam', sans-serif",
            fontWeight: 800,
            fontSize: "clamp(30px, 3.6vw, 54px)",
            lineHeight: 1.14,
            color: "#0d0d0d",
            letterSpacing: "-1px",
            margin: 0,
            whiteSpace: "nowrap",
          }}>
            Turn Every Comment<br />
            Into a{" "}
            <span style={{
              background: "linear-gradient(90deg, #FEDA75, #FA7E1E, #D62976, #962FBF, #4F5BD5)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>Follower</span>.<br />
            Every DM Into a{" "}
            <span style={{
              background: "linear-gradient(90deg, #FEDA75, #FA7E1E, #D62976, #962FBF, #4F5BD5)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}>Sale</span>.
          </h1>

          <p style={{
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 400,
            fontSize: 18,
            color: "#2a2a2a",
            lineHeight: 1.68,
            maxWidth: 450,
            margin: 0,
          }}>
            Auto-reply to every comment, grow your followers, and close sales
            organic — all before your next post goes live.
          </p>

          {/* Glass email form */}
          {submitted ? (
            <div style={{
              background: "rgba(34,197,94,0.15)",
              border: "1px solid rgba(34,197,94,0.35)",
              borderRadius: 16,
              padding: "16px 22px",
              maxWidth: 450,
            }}>
              <p style={{ fontFamily: "'Poppins', sans-serif", color: "#16a34a", fontWeight: 700, fontSize: 16 }}>
                🎉 You&apos;re on the list!
              </p>
              <p style={{ fontFamily: "'Poppins', sans-serif", color: "#2a2a2a", fontSize: 13, marginTop: 4 }}>
                We&apos;ll notify you when Zepply launches.
              </p>
            </div>
          ) : (
            <div style={{
              display: "flex",
              alignItems: "center",
              background: "rgba(255,255,255,0.32)",
              backdropFilter: "blur(18px)",
              WebkitBackdropFilter: "blur(18px)",
              border: "1.5px solid rgba(255,255,255,0.60)",
              borderRadius: 100,
              padding: "5px 5px 5px 22px",
              maxWidth: 450,
              boxShadow: "0 4px 28px rgba(0,0,0,0.09)",
            }}>
              <input
                type="email"
                placeholder="example@gmail.com"
                value={localEmail}
                onChange={e => setLocalEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && onJoin(localEmail)}
                style={{
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  flex: 1,
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: 14,
                  color: "#1a1a1a",
                  minWidth: 0,
                }}
              />
              <button
                onClick={() => onJoin(localEmail)}
                disabled={loading}
                style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontWeight: 600,
                  fontSize: 13,
                  letterSpacing: "0.5px",
                  background: "#1a1a1a",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 100,
                  padding: "13px 22px",
                  cursor: loading ? "not-allowed" : "pointer",
                  whiteSpace: "nowrap",
                  opacity: loading ? 0.7 : 1,
                  transition: "background 0.18s",
                }}
                onMouseEnter={e => !loading && (e.currentTarget.style.background = "#333")}
                onMouseLeave={e => (e.currentTarget.style.background = "#1a1a1a")}
              >
                {loading ? "..." : "JOIN WAITLIST"}
              </button>
            </div>
          )}

          {/* Meta Business Partners badge */}
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            background: "rgba(0,0,0,0.48)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            border: "1px solid rgba(255,255,255,0.18)",
            borderRadius: 10,
            padding: "7px 14px",
            width: "fit-content",
          }}>
            <Image src="/meta-badge.svg" alt="Meta Business Partners" width={148} height={32} />
          </div>
        </div>

        {/* ── RIGHT: Animated Chat bubbles ── */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: 24,
          paddingTop: 40, // Reduced top padding to fix vertical alignment
          paddingBottom: 40, // Padding to prevent bottom shadow clipping
          paddingLeft: 40, // Padding to prevent left shadow/edge clipping
          paddingRight: 40, // Padding to prevent right shadow/edge clipping
          alignItems: "flex-end",
          justifyContent: "flex-end",
          height: 650, // Fixed height to completely prevent grid layout shifts
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 20%, black 100%)",
          maskImage: "linear-gradient(to bottom, transparent 0%, black 20%, black 100%)",
          opacity: isFadingOut ? 0 : 1,
          transition: "opacity 0.8s ease-in-out",
        }}>
          <AnimatePresence initial={false}>
            {BUBBLES.slice(0, visibleCount).map((bubble) => (
              <motion.div
                key={bubble.id}
                layout
                initial={{ opacity: 0, y: 50, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                transition={{
                  layout: { type: "spring", stiffness: 300, damping: 24 },
                  opacity: { duration: 0.4 },
                  y: { type: "spring", stiffness: 300, damping: 24 }
                }}
                style={{
                  width: "100%",
                  maxWidth: 240,
                  alignSelf: "flex-end",
                  marginRight: bubble.mr,
                  flexShrink: 0,
                }}
              >
                <Image
                  src={bubble.src}
                  alt={bubble.alt}
                  width={bubble.width}
                  height={bubble.height}
                  style={{
                    width: "100%",
                    height: "auto",
                    filter: bubble.type === "bot" ? "drop-shadow(0 8px 24px rgba(0,0,0,0.12))" : "drop-shadow(0 6px 20px rgba(0,0,0,0.10))"
                  }}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
