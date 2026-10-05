export default function FeaturesSection() {
  return (
    <section style={{ background: "#F4F4F8", padding: "80px 20px" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#6366F1", letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 16 }}>What&apos;s inside Zepply</p>
          <h2 style={{ fontSize: "clamp(26px,4vw,44px)", fontWeight: 900, color: "#0F0F1A", letterSpacing: "-1.5px", lineHeight: 1.2 }}>
            Everything a creator actually needs.<br />Nothing they don&apos;t.
          </h2>
        </div>

        {/* Feature block 1: Core Intelligence */}
        <div style={{ background: "#EEF0FF", borderRadius: 20, padding: "40px", marginBottom: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center" }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#6366F1", letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>Core Intelligence</p>
            <h3 style={{ fontSize: "clamp(22px,3vw,32px)", fontWeight: 800, color: "#0F0F1A", letterSpacing: "-0.8px", marginBottom: 24 }}>
              Zepply means <span style={{ color: "#6366F1" }}>More Conversations</span>
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {[
                { icon: "🤖", title: "Real AI conversations", desc: "Not keyword matching. Context-aware dialogue that sounds exactly like you wrote it — every single time." },
                { icon: "💬", title: "Comment-to-DM automation", desc: "A comment triggers a DM. The DM starts a conversation. The conversation closes a sale." },
                { icon: "📖", title: "Story reply triggers", desc: "Your most engaged followers reply to stories. Now every reply becomes an automated warm lead." },
              ].map(({ icon, title, desc }) => (
                <div key={title} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{icon}</div>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: "#0F0F1A", marginBottom: 4 }}>{title}</p>
                    <p style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.6 }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Chat mockup */}
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>Live Conversation</p>
            <div style={{ background: "#fff", borderRadius: 16, padding: "20px 16px", boxShadow: "0 4px 20px rgba(99,102,241,0.1)" }}>
              {[
                { bot: false, text: "Looks good. Do you have more plans?" },
                { bot: true, text: "Yes! I have 8-week programs too. Want me to show them?", sub: true },
                { bot: false, text: "Sure, show me" },
                { bot: true, text: "Here are my popular programs 🔥", sub: true },
              ].map((m, i) => (
                <div key={i} style={{ display: "flex", justifyContent: m.bot ? "flex-end" : "flex-start", marginBottom: 8 }}>
                  <div style={{
                    background: m.bot ? "#6366F1" : "#F4F4F8",
                    color: m.bot ? "#fff" : "#0F0F1A",
                    borderRadius: m.bot ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                    padding: "9px 13px", fontSize: 13, maxWidth: 200, lineHeight: 1.4,
                  }}>{m.text}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Feature block 2: Revenue Engine */}
        <div style={{ background: "#F0FDF4", borderRadius: 20, padding: "40px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center" }}>
          {/* Dashboard mockup */}
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 12 }}>Revenue Dashboard</p>
            <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 4px 20px rgba(34,197,94,0.08)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                {[["Conversations this week", "142"], ["Leads captured", "23"]].map(([l, v]) => (
                  <div key={l} style={{ background: "#F4F4F8", borderRadius: 10, padding: 14 }}>
                    <p style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 4 }}>{l}</p>
                    <p style={{ fontSize: 24, fontWeight: 800, color: "#0F0F1A" }}>{v}</p>
                  </div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[["Revenue attributed", "₹1,840"], ["vs last week", "+34%"]].map(([l, v]) => (
                  <div key={l} style={{ background: "#F4F4F8", borderRadius: 10, padding: 14 }}>
                    <p style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 4 }}>{l}</p>
                    <p style={{ fontSize: 22, fontWeight: 800, color: l === "vs last week" ? "#16A34A" : "#0F0F1A" }}>{v}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#16A34A", letterSpacing: 2, textTransform: "uppercase", marginBottom: 16 }}>Revenue Engine</p>
            <h3 style={{ fontSize: "clamp(22px,3vw,32px)", fontWeight: 800, color: "#0F0F1A", letterSpacing: "-0.8px", marginBottom: 24 }}>
              Zepply means <span style={{ color: "#16A34A" }}>More Revenue</span>
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {[
                { icon: "📊", title: "Revenue attribution", desc: "Know exactly which post, comment, and automated reply generated revenue. Finally." },
                { icon: "📋", title: "Lead capture + mini CRM", desc: "Every lead auto-tagged, organized, and exportable. Your audience data always stays with you." },
                { icon: "🔗", title: "Link-in-bio replacement", desc: "Every DM becomes a personalized storefront. No more link-in-bio limitations." },
              ].map(({ icon, title, desc }) => (
                <div key={title} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "#DCFCE7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{icon}</div>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: "#0F0F1A", marginBottom: 4 }}>{title}</p>
                    <p style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.6 }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
