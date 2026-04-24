export const metadata = {
  title: "Privacy Policy – Zepply",
};

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "60px 24px", fontFamily: "sans-serif", color: "#1a1a1a" }}>
      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ color: "#666", marginBottom: 40 }}>Last updated: April 24, 2026</p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>1. What We Collect</h2>
        <p>Zepply collects your Instagram account information (username, profile picture, follower count) and access tokens when you connect your Instagram account. We also store leads (Instagram usernames of people who trigger your automations) and analytics data.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>2. How We Use Your Data</h2>
        <p>We use your data solely to provide the Zepply service — automating Instagram comment replies and direct messages based on triggers you define. We do not sell your data to third parties.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>3. Instagram Permissions</h2>
        <p>Zepply requests the following Instagram permissions: reading comments, sending direct messages, and reading basic profile information. These are used exclusively to operate your automations.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>4. Data Storage</h2>
        <p>Your data is stored securely in a PostgreSQL database hosted on Supabase. Access tokens are stored encrypted and are never shared with third parties.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>5. Data Deletion</h2>
        <p>You can delete your account and all associated data at any time from the Settings page in your Zepply dashboard. Upon deletion, all your data including access tokens, triggers, and leads are permanently removed.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>6. Contact</h2>
        <p>For any privacy-related questions, contact us at <a href="mailto:support@zepply.app" style={{ color: "#6C3AE8" }}>support@zepply.app</a></p>
      </section>
    </div>
  );
}
