const pains = [
  { icon: "💬", title: "Comments disappear before you can reply", desc: "By the time you see it, the algorithm has moved on. That lead is gone." },
  { icon: "🔗", title: '"Link please?" ×50. You replied to zero.', desc: "Same question, infinite times. Each one is a sale you walked away from." },
  { icon: "⚙️", title: "DM tools built for developers, not creators", desc: "Complex setup, webhook hell, support docs written in API-speak." },
  { icon: "📈", title: "Your bill grows every time your audience does", desc: "Scaled pricing punishes your success. The bigger you get, the more you pay." },
  { icon: "🤖", title: "Bots that sound like bots", desc: "Your followers can tell. Generic responses kill trust and tank your conversion." },
  { icon: "📊", title: "No idea what's actually working", desc: "You're posting into a void. No attribution, no data, no decisions." },
];

export default function PainSection() {
  return (
    <section style={{ background: "#F4F4F8", padding: "80px 20px" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        {/* Label */}
        <p style={{ fontSize: 12, fontWeight: 700, color: "#6366F1", letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 20 }}>
          Why creators keep losing
        </p>
        {/* Headline */}
        <h2 style={{ fontSize: "clamp(28px,4.5vw,48px)", fontWeight: 900, color: "#0F0F1A", lineHeight: 1.15, letterSpacing: "-1.5px", maxWidth: 560, marginBottom: 14 }}>
          You&apos;re posting every day. Your followers aren&apos;t growing fast enough. And your DMs are eating your time alive.
        </h2>
        <p style={{ fontSize: 15, color: "#6B7280", marginBottom: 48 }}>
          The problem isn&apos;t your content. It&apos;s everything that happens after you post.
        </p>

        {/* Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {pains.map(({ icon, title, desc }) => (
            <div key={title} style={{
              background: "#fff", borderRadius: 16, padding: "24px 22px",
              border: "1px solid #EBEBEB",
            }}>
              <div style={{ fontSize: 22, marginBottom: 12 }}>{icon}</div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0F0F1A", marginBottom: 8, lineHeight: 1.4 }}>{title}</h3>
              <p style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.6 }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
