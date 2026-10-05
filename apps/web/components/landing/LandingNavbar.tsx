"use client";

export default function LandingNavbar() {
  const links = [
    { label: "How it works", href: "#how-it-works" },
    { label: "Use Cases", href: "#use-cases" },
    { label: "Pricing", href: "#pricing" },
    { label: "Learn", href: "#faq" },
  ];

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
        background: "rgba(17,17,22,0.72)",
        border: "1px solid #23232B",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderRadius: 10,
        padding: "8px 10px 8px 24px",
        boxShadow: "0 4px 32px rgba(0,0,0,0.45)",
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
        <div className="hidden md:flex" style={{ alignItems: "center", gap: 4, marginLeft: "auto", marginRight: 16 }}>
          {links.map(l => (
            <a
              key={l.label}
              href={l.href}
              style={{
                textDecoration: "none",
                cursor: "pointer",
                fontFamily: "'Poppins', sans-serif",
                fontWeight: 400,
                fontSize: 14,
                color: "#A1A1AA",
                padding: "6px 12px",
                borderRadius: 8,
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                transition: "color 0.15s",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
              onMouseLeave={e => (e.currentTarget.style.color = "#A1A1AA")}
            >
              {l.label}
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          ))}
        </div>

        {/* CTA */}
        <a
          href="#waitlist"
          style={{
            marginLeft: "auto",
            textDecoration: "none",
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 500,
            fontSize: 14,
            letterSpacing: "0.5px",
            background: "#3D7EFF",
            color: "#ffffff",
            border: "none",
            borderRadius: 100,
            padding: "10px 22px",
            cursor: "pointer",
            whiteSpace: "nowrap",
            flexShrink: 0,
            boxShadow: "0 0 24px -4px rgba(61,126,255,0.7), inset 0 0 0 1px rgba(255,255,255,0.2)",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "#5A92FF"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "#3D7EFF"; }}
        >
          JOIN WAITLIST
        </a>
      </div>
    </nav>
  );
}
