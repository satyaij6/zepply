import Image from "next/image";
import Link from "next/link";
import { Check } from "lucide-react";
import { signIn } from "@/lib/auth";
import { Accent } from "@/components/landing/home/SectionHeader";

type Mode = "signup" | "login";

const COPY: Record<Mode, { title: string; accent: string; lede: string; switchText: string; switchLink: string; switchHref: string }> = {
  signup: {
    title: "Start",
    accent: "free",
    lede: "Create your Zepply account in seconds, then we'll set up your brand together.",
    switchText: "Already have an account?",
    switchLink: "Log in",
    switchHref: "/login",
  },
  login: {
    title: "Welcome",
    accent: "back",
    lede: "Log in to your Zepply workspace.",
    switchText: "New to Zepply?",
    switchLink: "Start free",
    switchHref: "/signup",
  },
};

const ASSURANCES = ["No credit card required", "Setup in 5 minutes", "Official Instagram API"];

// Auth.js error codes and our own (from the Instagram callback), in words people can act on
const ERRORS: Record<string, string> = {
  AccessDenied: "That Google account couldn't be used. Try one with a verified email address.",
  Configuration: "Google sign-in isn't set up yet. Please try again later.",
  OAuthCallbackError: "Google sign-in was cancelled. Please try again.",
  signup_first: "That Instagram account isn't on Zepply yet. Create your account with Google first, then connect Instagram.",
  instagram_auth_failed: "Instagram sign-in was cancelled. Please try again.",
  callback_failed: "We couldn't reach Instagram just now. Please try again.",
  no_code: "Instagram didn't send us back correctly. Please try again.",
  account_missing: "Your session has expired. Please log in again.",
};

/** Sign-up and log-in share one screen: same glow and type as the landing page, one Google button. */
export default function AuthScreen({ mode, error }: { mode: Mode; error?: string }) {
  const copy = COPY[mode];
  const message = error ? ERRORS[error] ?? "Something went wrong. Please try again." : null;

  async function continueWithGoogle() {
    "use server";
    // /start sends people who have finished onboarding on to the dashboard
    await signIn("google", { redirectTo: "/start" });
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-night">
      {/* The hero's drifting glows and light beam */}
      <div
        aria-hidden
        className="absolute left-[30%] top-[5%] h-[80%] w-[70%] animate-[glow-drift-a_26s_ease-in-out_infinite_alternate] will-change-transform motion-reduce:animate-none"
        style={{ background: "radial-gradient(closest-side, rgba(37,64,170,0.42), rgba(37,64,170,0))" }}
      />
      <div
        aria-hidden
        className="absolute -left-[15%] top-[40%] h-[60%] w-[55%] animate-[glow-drift-c_30s_ease-in-out_infinite_alternate] will-change-transform motion-reduce:animate-none"
        style={{ background: "radial-gradient(closest-side, rgba(80,70,210,0.18), rgba(80,70,210,0))" }}
      />
      <div aria-hidden className="absolute left-1/2 top-0 h-36 w-14 origin-top -translate-x-1/2 animate-[beam-pulse_4s_ease-in-out_infinite_alternate] bg-linear-to-b from-electric/60 to-transparent blur-xl motion-reduce:animate-none" />

      <header className="relative px-4 pt-6 sm:px-8">
        <Link href="/" className="font-[Glitz,Poppins,sans-serif] text-[22px] text-white" aria-label="Zepply home">
          Zepply
        </Link>
      </header>

      <main className="relative flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-[420px] text-center">
          <Image
            src="/landing/zepply-app-icon.png"
            alt=""
            width={128}
            height={128}
            className="mx-auto h-16 w-16 -rotate-6 drop-shadow-[0_0.5rem_1.4rem_rgba(61,126,255,0.45)]"
          />

          <h1 className="mt-8 font-display text-[clamp(44px,9vw,64px)] font-semibold leading-[1] tracking-[-0.035em] text-white">
            {copy.title} <Accent>{copy.accent}</Accent>.
          </h1>
          <p className="mx-auto mt-5 max-w-[340px] text-base leading-relaxed text-zinc-400">{copy.lede}</p>

          {message && (
            <p role="alert" className="mt-8 rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-left text-sm leading-relaxed text-red-200">
              {message}
            </p>
          )}

          <form action={continueWithGoogle} className="mt-8">
            <button
              type="submit"
              className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-white text-[15px] font-semibold text-zinc-900 shadow-[0_0_32px_-8px_rgba(61,126,255,0.6)] transition hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric"
            >
              <GoogleMark />
              Continue with Google
            </button>
          </form>

          {mode === "login" && (
            <>
              <div className="my-6 flex items-center gap-4 text-xs uppercase tracking-[0.18em] text-zinc-600">
                <span className="h-px flex-1 bg-night-line" />
                or
                <span className="h-px flex-1 bg-night-line" />
              </div>
              <a
                href="/api/instagram/connect"
                className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-xl border border-white/15 text-[15px] font-medium text-white transition hover:border-white/40 hover:bg-white/[0.04]"
              >
                Log in with Instagram
              </a>
            </>
          )}

          {mode === "signup" && (
            <ul className="mt-7 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-zinc-400">
              {ASSURANCES.map((a) => (
                <li key={a} className="inline-flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-electric-bright" /> {a}
                </li>
              ))}
            </ul>
          )}

          <p className="mt-10 text-sm text-zinc-400">
            {copy.switchText}{" "}
            <Link href={copy.switchHref} className="font-medium text-white underline-offset-4 hover:underline">
              {copy.switchLink}
            </Link>
          </p>
        </div>
      </main>

      <footer className="relative px-4 pb-6 text-center text-xs text-zinc-600">
        By continuing, you agree to our{" "}
        <Link href="/privacy" className="text-zinc-400 underline-offset-4 hover:underline">
          Privacy Policy
        </Link>
        .
      </footer>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5">
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.63h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.56-5.17 3.56-8.8Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.88-3.02c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.11A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.28 14.28a7.2 7.2 0 0 1 0-4.56V6.61H1.27a12 12 0 0 0 0 10.78l4.01-3.11Z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.27 6.61l4.01 3.11C6.22 6.88 8.87 4.77 12 4.77Z" />
    </svg>
  );
}
