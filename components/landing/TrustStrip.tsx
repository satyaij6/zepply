export default function TrustStrip() {
  const items = ["100% Meta-approved", "Used by coaches & creators", "Setup in under 5 minutes"];

  return (
    <div style={{
      background: "#ffffff",
      borderTop: "1px solid #e8e8e8",
      height: 60,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "0 40px",
    }}>
      {items.map((item, i) => (
        <div key={item} style={{ display: "flex", alignItems: "center" }}>
          {i > 0 && (
            <div style={{ width: 1, height: 22, background: "#C8C8C8", flexShrink: 0 }} />
          )}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            fontFamily: "'Poppins', sans-serif",
            fontSize: 13.5,
            fontWeight: 400,
            color: "#5a5a5a",
            padding: "0 44px",
            whiteSpace: "nowrap",
          }}>
            <span style={{ fontSize: 15, color: "#888" }}>✳</span>
            {item}
          </div>
        </div>
      ))}
    </div>
  );
}
