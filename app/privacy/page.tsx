export const metadata = {
  title: "Privacy Policy – Zepply",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 px-6 py-16">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold mb-2 text-gray-900">Privacy Policy</h1>
        <p className="text-gray-500 mb-12">Last updated: April 24, 2026</p>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3 text-gray-900">1. What We Collect</h2>
          <p className="text-gray-700 leading-relaxed">
            Zepply collects your Instagram account information (username, profile picture, follower count)
            and access tokens when you connect your Instagram account. We also store leads (Instagram
            usernames of people who trigger your automations) and analytics data.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3 text-gray-900">2. How We Use Your Data</h2>
          <p className="text-gray-700 leading-relaxed">
            We use your data solely to provide the Zepply service — automating Instagram comment replies
            and direct messages based on triggers you define. We do not sell your data to third parties.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3 text-gray-900">3. Instagram Permissions</h2>
          <p className="text-gray-700 leading-relaxed">
            Zepply requests the following Instagram permissions: reading and managing comments,
            sending and receiving direct messages, accessing and publishing content, and reading
            basic profile information. These permissions are used exclusively to operate your automations.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3 text-gray-900">4. Data Storage</h2>
          <p className="text-gray-700 leading-relaxed">
            Your data is stored securely in a PostgreSQL database hosted on Supabase (AWS infrastructure).
            Access tokens are stored securely and are never shared with third parties.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3 text-gray-900">5. Data Deletion</h2>
          <p className="text-gray-700 leading-relaxed">
            You can delete your account and all associated data at any time from the Settings page in
            your Zepply dashboard. Upon deletion, all your data including access tokens, triggers, and
            leads are permanently removed from our systems.
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3 text-gray-900">6. Third-Party Services</h2>
          <p className="text-gray-700 leading-relaxed">
            Zepply uses the Instagram Graph API (Meta) to interact with Instagram on your behalf.
            Your use of Zepply is also subject to{" "}
            <a href="https://www.facebook.com/privacy/policy/" className="text-purple-600 underline" target="_blank">
              Meta&apos;s Privacy Policy
            </a>
            .
          </p>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3 text-gray-900">7. Contact</h2>
          <p className="text-gray-700 leading-relaxed">
            For any privacy-related questions, contact us at{" "}
            <a href="mailto:support@zepply.app" className="text-purple-600 underline">
              support@zepply.app
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
