"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Film, Scissors, Wand2 } from "lucide-react";
import { isDemo } from "@/components/layout/DashboardLayout";
import { ReelCard, type ReelRow } from "@/components/create/promo/Generating";

export default function CreatePage() {
  const [reels, setReels] = useState<ReelRow[] | null>(null);

  useEffect(() => {
    if (isDemo()) return void queueMicrotask(() => setReels([]));
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const load = () =>
      fetch("/api/reels")
        .then((r) => {
          if (r.status === 401) window.location.replace("/login");
          return r.ok ? r.json() : { reels: [] };
        })
        .then((d: { reels: ReelRow[] }) => {
          if (!alive) return;
          setReels(d.reels);
          if (d.reels.some((r) => r.status === "QUEUED" || r.status === "RUNNING")) timer = setTimeout(load, 4000);
        })
        .catch(() => alive && setReels([]));
    load();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="space-y-10 pb-12 pt-2">
      <div>
        <h1 className="font-display text-[clamp(28px,3vw,40px)] font-semibold leading-tight tracking-[-0.03em]">Create</h1>
        <p className="mt-2 text-[15px] text-app-muted">Videos for your business, made for you.</p>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Link href="/dashboard/create/promo" className="group relative overflow-hidden rounded-[28px] bg-app-side p-7 text-white sm:p-9">
          <div aria-hidden className="absolute -right-[20%] -top-1/2 h-[160%] w-[80%]" style={{ background: "radial-gradient(closest-side, rgba(61,126,255,0.35), rgba(61,126,255,0))" }} />
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-zinc-200">
              <Wand2 className="h-3.5 w-3.5" /> New
            </span>
            <h2 className="mt-5 font-display text-[clamp(26px,2.6vw,34px)] font-semibold leading-[1.1] tracking-[-0.03em]">
              Promo reel, <span className="font-serif font-normal italic text-silver">in two minutes</span>
            </h2>
            <p className="mt-3 max-w-[420px] text-[15px] leading-relaxed text-zinc-400">
              Tell us about your business. We write the words, add your photos and music, and make it for Reels, posts, YouTube or WhatsApp.
            </p>
            <span className="mt-7 inline-flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-app-ink transition group-hover:bg-zinc-200">
              Make a promo reel <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </span>
          </div>
        </Link>

        <div className="grid gap-5">
          <Link href="/dashboard/create/clips" className="group flex items-start gap-4 rounded-3xl border border-app-line bg-app-card p-6 transition hover:border-zinc-300 hover:bg-white">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-app-side text-white">
              <Scissors className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold">Long video to shorts</p>
              <p className="mt-1 text-sm text-app-muted">A podcast or YouTube video becomes clips, each with a cover, caption and hashtags</p>
            </div>
            <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-app-faint transition group-hover:translate-x-0.5 group-hover:text-app-ink" />
          </Link>
          {[{ icon: Film, title: "Raw clips to an edited reel", hint: "Upload your clips; we cut them into one reel" }].map(({ icon: Icon, title, hint }) => (
            <div key={title} className="flex items-start gap-4 rounded-3xl border border-app-line bg-app-card p-6">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-app-bg text-app-muted">
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
                  {title}
                  <span className="rounded-full border border-app-line px-2 py-px text-[10px] font-semibold uppercase tracking-wider text-app-faint">Soon</span>
                </p>
                <p className="mt-1 text-sm text-app-muted">{hint}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <section>
        <h2 className="font-display text-lg font-semibold tracking-[-0.02em]">Your reels</h2>
        {reels === null ? (
          <div className="mt-4 h-40 animate-pulse rounded-3xl bg-white/60" />
        ) : reels.length === 0 ? (
          <p className="mt-3 text-sm text-app-muted">Reels you make will show up here, ready to download.</p>
        ) : (
          <div className="mt-5 flex flex-wrap items-start gap-6">
            {reels.map((r) => (
              <ReelCard key={r.id} reel={r} compact />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
