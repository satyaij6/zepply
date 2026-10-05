export default function ComparisonTable() {
  const rows = [
    { feature: "24/7 auto-reply", zepply: true, va: false, manual: false },
    { feature: "Keyword DM triggers", zepply: true, va: false, manual: false },
    { feature: "AI-generated replies", zepply: true, va: false, manual: false },
    { feature: "Lead capture", zepply: true, va: "Sometimes", manual: false },
    { feature: "Meta-compliant", zepply: true, va: true, manual: true },
    { feature: "Cost per month", zepply: "Free / ₹499", va: "₹15,000+", manual: "Your time" },
    { feature: "Setup time", zepply: "5 mins", va: "Days", manual: "Always" },
  ];

  const cell = (val: boolean | string) => {
    if (val === true) return <span style={{ color: "#16A34A", fontSize: 20 }}>✓</span>;
    if (val === false) return <span style={{ color: "#DC2626", fontSize: 18 }}>✗</span>;
    return <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{val}</span>;
  };

  return (
    <section style={{ padding: "96px 24px", background: "#fff" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#7C6FFF", letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>
            Why Zepply?
          </p>
          <h2 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 800, letterSpacing: "-1px", color: "#0A0A0A" }}>
            Zepply vs. the alternatives
          </h2>
        </div>

        <div style={{ overflowX: "auto", borderRadius: 20, border: "1px solid #F0F0F0", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "#F8F7FF" }}>
                <th style={{ padding: "16px 24px", textAlign: "left", fontWeight: 700, color: "#6B7280", borderBottom: "1px solid #F0F0F0" }}>Feature</th>
                <th style={{ padding: "16px 24px", textAlign: "center", fontWeight: 700, color: "#7C6FFF", borderBottom: "1px solid #F0F0F0" }}>
                  <span style={{ background: "linear-gradient(135deg,#7C6FFF,#A78BFA)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Zepply ⚡</span>
                </th>
                <th style={{ padding: "16px 24px", textAlign: "center", fontWeight: 700, color: "#9CA3AF", borderBottom: "1px solid #F0F0F0" }}>Virtual Assistant</th>
                <th style={{ padding: "16px 24px", textAlign: "center", fontWeight: 700, color: "#9CA3AF", borderBottom: "1px solid #F0F0F0" }}>Manual Reply</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ feature, zepply, va, manual }, i) => (
                <tr key={feature} style={{ background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                  <td style={{ padding: "14px 24px", fontWeight: 500, color: "#374151", borderBottom: "1px solid #F5F5F5" }}>{feature}</td>
                  <td style={{ padding: "14px 24px", textAlign: "center", borderBottom: "1px solid #F5F5F5" }}>{cell(zepply)}</td>
                  <td style={{ padding: "14px 24px", textAlign: "center", borderBottom: "1px solid #F5F5F5" }}>{cell(va)}</td>
                  <td style={{ padding: "14px 24px", textAlign: "center", borderBottom: "1px solid #F5F5F5" }}>{cell(manual)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
