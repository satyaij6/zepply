export default function LandingFooter() {
  return (
    <footer style={{
      background: "#0A0A0A", color: "#9CA3AF",
      padding: "48px 24px 32px",
    }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 32, marginBottom: 40 }}>
          {/* Brand */}
          <div style={{ maxWidth: 280 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 9,
                background: "linear-gradient(135deg, #7C6FFF, #A78BFA)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>Z</span>
              </div>
              <span style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>Zepply</span>
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.7, color: "#6B7280" }}>
              Automate your Instagram engagement. Capture leads. Grow on autopilot. Built for Indian creators.
            </p>
          </div>

          {/* Links */}
          <div style={{ display: "flex", gap: 48, flexWrap: "wrap" }}>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 14 }}>Product</p>
              {["Features", "How it Works", "Pricing", "FAQ"].map(l => (
                <p key={l} style={{ fontSize: 14, marginBottom: 10, cursor: "pointer", color: "#6B7280" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#6B7280")}
                >{l}</p>
              ))}
            </div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 14 }}>Legal</p>
              {["Privacy Policy", "Terms of Service"].map(l => (
                <p key={l} style={{ fontSize: 14, marginBottom: 10, cursor: "pointer", color: "#6B7280" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#6B7280")}
                >{l}</p>
              ))}
            </div>
          </div>
        </div>

        <div style={{ borderTop: "1px solid #1F1F1F", paddingTop: 24, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <p style={{ fontSize: 13, color: "#4B5563" }}>© 2026 Zepply. All rights reserved.</p>
          <p style={{ fontSize: 13, color: "#4B5563" }}>Made with ❤️ for India 🇮🇳</p>
        </div>
      </div>
    </footer>
  );
}
