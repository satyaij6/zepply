"use client";

export default function LandingNavbar({ onJoinClick }: { onJoinClick: () => void }) {
  const links = ["How it works", "Use Cases", "Pricing", "Learn"];

  return (
    <nav style={{
      position: "fixed",
      top: 18,
      left: 0,
      right: 0,
      zIndex: 100,
      display: "flex",
      justifyContent: "center",
      padding: "0 24px",
      pointerEvents: "none",
    }}>
      <div style={{
        pointerEvents: "auto",
        display: "flex",
        alignItems: "center",
        gap: 0,
        background: "#333338",
        borderRadius: 10,
        padding: "8px 10px 8px 24px",
        boxShadow: "0 4px 32px rgba(0,0,0,0.28)",
        width: "100%",
        maxWidth: 860,
      }}>
        {/* Logo */}
        <span style={{
          fontFamily: "'Glitz', 'Poppins', sans-serif",
          fontWeight: 400,
          fontSize: 22,
          color: "#ffffff",
          letterSpacing: "-0.2px",
          whiteSpace: "nowrap",
          userSelect: "none",
          marginRight: 28,
        }}>
          Zepply
        </span>

        {/* Nav Links */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1 }}>
          {links.map(l => (
            <button
              key={l}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "'Poppins', sans-serif",
                fontWeight: 400,
                fontSize: 14,
                color: "rgba(255,255,255,0.80)",
                padding: "6px 12px",
                borderRadius: 8,
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                transition: "color 0.15s",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.80)")}
            >
              {l}
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={onJoinClick}
          style={{
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 500,
            fontSize: 14,
            letterSpacing: "0.5px",
            background: "#ffffff",
            color: "#1a1a1a",
            border: "none",
            borderRadius: 100,
            padding: "10px 22px",
            cursor: "pointer",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "#f0f0f0"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "#ffffff"; }}
        >
          JOIN WAITLIST
        </button>
      </div>
    </nav>
  );
}
