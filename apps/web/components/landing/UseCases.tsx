const cases = [
  {
    tag: "Coaches & educators", tagColor: "#EDE9FE", tagText: "#5B21B6",
    title: "Fill your cohort without filling your DMs",
    desc: "Auto-qualify leads, share program links, and enroll students — without spending hours replying to \"how do I join?\"",
    stat: "✓ +340% enrollment conversations", statColor: "#D1FAE5", statText: "#065F46",
  },
  {
    tag: "Fitness & lifestyle", tagColor: "#FCE7F3", tagText: "#9D174D",
    title: "Sell programs while you sleep",
    desc: 'Every "what plan do I start with?" becomes an automated sales conversation that actually converts.',
    stat: "✓ 8× more DM replies handled", statColor: "#D1FAE5", statText: "#065F46",
  },
  {
    tag: "Micro & nano creators", tagColor: "#DBEAFE", tagText: "#1E40AF",
    title: "Compete like a big account",
    desc: "With 1,000 followers or 10,000 — Zepply makes you look and convert like someone with a full team behind them.",
    stat: "✓ 5-min setup, no team needed", statColor: "#D1FAE5", statText: "#065F46",
  },
  {
    tag: "eCommerce & brands", tagColor: "#FEF3C7", tagText: "#92400E",
    title: "Instagram as a sales channel",
    desc: "Comments trigger product links, DMs close orders, and every reply is tracked back to revenue in your dashboard.",
    stat: "✓ Direct comment-to-checkout flow", statColor: "#D1FAE5", statText: "#065F46",
  },
];

export default function UseCases() {
  return (
    <section style={{ background: "#F4F4F8", padding: "80px 20px" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#6366F1", letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 20 }}>
          Built for every kind of creator
        </p>
        <h2 style={{ fontSize: "clamp(28px,4.5vw,48px)", fontWeight: 900, color: "#0F0F1A", letterSpacing: "-1.5px", lineHeight: 1.15, maxWidth: 520, marginBottom: 48 }}>
          Whether you have 1,000 followers or 100,000 — Zepply works the same way.
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
          {cases.map(({ tag, tagColor, tagText, title, desc, stat, statColor, statText }) => (
            <div key={title} style={{
              background: "#fff", borderRadius: 18, padding: "28px 28px 24px",
              border: "1px solid #EBEBEB", display: "flex", flexDirection: "column", gap: 14,
            }}>
              <div style={{ display: "inline-flex" }}>
                <span style={{ fontSize: 12, fontWeight: 600, background: tagColor, color: tagText, borderRadius: 100, padding: "4px 12px" }}>{tag}</span>
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: "#0F0F1A", letterSpacing: "-0.5px", lineHeight: 1.3 }}>{title}</h3>
              <p style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.7 }}>{desc}</p>
              <div style={{ display: "inline-flex" }}>
                <span style={{ fontSize: 12, fontWeight: 600, background: statColor, color: statText, borderRadius: 8, padding: "5px 12px" }}>{stat}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
