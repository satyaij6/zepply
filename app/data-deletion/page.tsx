export const metadata = {
  title: "Data Deletion – Zepply",
};

export default function DataDeletionPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 px-6 py-16">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold mb-2 text-gray-900">Data Deletion Instructions</h1>
        <p className="text-gray-500 mb-12">Last updated: April 24, 2026</p>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3 text-gray-900">How to Delete Your Data</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            You can request deletion of all your Zepply data in two ways:
          </p>
          <ol className="list-decimal list-inside space-y-3 text-gray-700">
            <li>
              <strong>From the app:</strong> Log in to{" "}
              <a href="https://zepply.app/dashboard" className="text-purple-600 underline">
                zepply.app/dashboard
              </a>{" "}
              → go to <strong>Settings</strong> → click <strong>Delete Account</strong>. All your
              data will be permanently deleted immediately.
            </li>
            <li>
              <strong>By email:</strong> Send a deletion request to{" "}
              <a href="mailto:support@zepply.app" className="text-purple-600 underline">
                support@zepply.app
              </a>{" "}
              with your Instagram username. We will delete all your data within 30 days.
            </li>
          </ol>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3 text-gray-900">What Gets Deleted</h2>
          <ul className="list-disc list-inside space-y-2 text-gray-700">
            <li>Your Instagram account connection and access tokens</li>
            <li>All triggers you created</li>
            <li>All leads captured by your triggers</li>
            <li>All analytics data</li>
            <li>Your Zepply account and profile</li>
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="text-xl font-semibold mb-3 text-gray-900">Instagram Data</h2>
          <p className="text-gray-700 leading-relaxed">
            To revoke Zepply&apos;s access to your Instagram account independently, go to your
            Instagram Settings → Security → Apps and Websites → find Zepply and click Remove.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3 text-gray-900">Contact</h2>
          <p className="text-gray-700 leading-relaxed">
            For any questions about data deletion, email us at{" "}
            <a href="mailto:support@zepply.app" className="text-purple-600 underline">
              support@zepply.app
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
