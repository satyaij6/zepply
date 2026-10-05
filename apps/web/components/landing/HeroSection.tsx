"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

const BUBBLES = [
  { id: 1, type: "bot", src: "/chat-bubble-1.png", alt: "Here's your 30-day home workout plan", width: 240, height: 110, mr: 0 },
  { id: 2, type: "user", src: "/user-bubble-1.png", alt: "Looks good. Do you have more plans?", width: 240, height: 80, mr: 140 },
  { id: 3, type: "bot", src: "/chat-bubble-2.png", alt: "Yes! I have 8-week fat loss and muscle gain programs", width: 240, height: 100, mr: 0 },
  { id: 4, type: "user", src: "/user-bubble-2.png", alt: "Sure, show me", width: 240, height: 60, mr: 140 },
  { id: 5, type: "bot", src: "/chat-bubble-3.png", alt: "Here are my popular programs", width: 240, height: 110, mr: 0 },
  { id: 6, type: "user", src: "/user-bubble-3.png", alt: "I need this plan!", width: 240, height: 60, mr: 140 },
];

export default function HeroSection() {

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
            maxWidth: 480,
            margin: 0,
          }}>
            Auto-reply to every comment, grow your followers, and close sales
            organic — all before your next post goes live.
          </p>

          <a
            href="/api/instagram/connect"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              fontFamily: "'Poppins', sans-serif",
              fontWeight: 600,
              fontSize: 15,
              letterSpacing: "0.3px",
              background: "linear-gradient(90deg, #FEDA75, #FA7E1E, #D62976, #962FBF, #4F5BD5)",
              color: "#ffffff",
              border: "none",
              borderRadius: 100,
              padding: "14px 28px",
              cursor: "pointer",
              textDecoration: "none",
              whiteSpace: "nowrap",
              boxShadow: "0 4px 24px rgba(214,41,118,0.35)",
              transition: "opacity 0.18s, box-shadow 0.18s",
              width: "fit-content",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLAnchorElement).style.opacity = "0.88";
              (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 6px 32px rgba(214,41,118,0.50)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLAnchorElement).style.opacity = "1";
              (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 4px 24px rgba(214,41,118,0.35)";
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
            </svg>
            Connect Instagram
          </a>

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
