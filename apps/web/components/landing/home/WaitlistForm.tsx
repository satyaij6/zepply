"use client";
import { useState } from "react";
import { ArrowRight, Check, Loader2 } from "lucide-react";

type Status = "idle" | "loading" | "done" | "error";

export default function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setMessage(data.message === "Already on the list!" ? "You're already on the list." : "You're on the list. We'll be in touch soon.");
      setStatus("done");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <p className="mx-auto mt-10 flex w-fit items-center gap-2 rounded-xl bg-[#10A36B]/15 px-5 py-4 font-medium text-[#34D399]">
        <Check className="h-5 w-5" /> {message}
      </p>
    );
  }

  return (
    <>
      <form onSubmit={join} className="mx-auto mt-10 flex w-full max-w-[520px] flex-col gap-3 sm:flex-row">
        <label htmlFor="waitlist-email" className="sr-only">
          Email address
        </label>
        <input
          id="waitlist-email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-14 w-full rounded-xl border border-white/15 bg-night/70 px-5 text-base text-white outline-none backdrop-blur placeholder:text-zinc-500 focus:border-electric sm:flex-1"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="inline-flex h-14 items-center justify-center gap-2.5 rounded-xl bg-electric px-7 text-base font-medium text-white shadow-[0_0_32px_-6px_rgba(61,126,255,0.7)] ring-1 ring-inset ring-white/20 transition hover:bg-electric-bright disabled:opacity-70"
        >
          {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Join the waitlist <ArrowRight className="h-4 w-4" /></>}
        </button>
      </form>
      {status === "error" && <p className="mt-3 text-sm text-[#F87171]">{message}</p>}
    </>
  );
}
