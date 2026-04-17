import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-600 to-purple-400 flex items-center justify-center">
            <span className="text-white font-bold">Z</span>
          </div>
          <span className="text-xl font-bold text-gray-900 dark:text-white">Zepply</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Login
          </Link>
          <Link
            href="/login"
            className="px-5 py-2.5 text-sm font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
          >
            Start Free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="max-w-4xl mx-auto px-6 pt-20 pb-32 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-purple-50 dark:bg-purple-900/20 rounded-full text-sm text-purple-700 dark:text-purple-300 font-medium mb-8">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          100% Meta-compliant · Zero ban risk
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 dark:text-white leading-tight tracking-tight">
          Your next follower is already your next customer.{" "}
          <span className="text-purple-600">They just need you to reply.</span>
        </h1>

        <p className="text-lg text-gray-500 dark:text-gray-400 mt-6 max-w-2xl mx-auto leading-relaxed">
          Zepply auto-replies to every comment, DM, story reply, and new follower.
          Capture leads on autopilot. Free forever.
        </p>

        <div className="mt-10">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-8 py-4 text-base font-semibold text-white bg-purple-600 rounded-xl hover:bg-purple-700 transition-all shadow-lg shadow-purple-200 dark:shadow-purple-900/30 hover:shadow-xl hover:-translate-y-0.5"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
            </svg>
            Connect Instagram — It&apos;s Free
          </Link>
        </div>

        {/* Benefit pills */}
        <div className="flex flex-wrap justify-center gap-3 mt-10">
          {[
            "100% Meta-compliant · No ban risk",
            "Set up in 5 minutes",
            "Free forever plan",
          ].map((text) => (
            <span
              key={text}
              className="px-4 py-2 bg-gray-50 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-400 rounded-full border border-gray-200 dark:border-gray-700"
            >
              {text}
            </span>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 py-8 text-center">
        <p className="text-sm text-gray-400 dark:text-gray-500">
          Made for India 🇮🇳 · Zepply 2026
        </p>
      </footer>
    </div>
  );
}
