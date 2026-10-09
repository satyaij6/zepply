"use client";

import { useEffect, useState } from "react";
import { isDemo } from "@/components/layout/DashboardLayout";
import { ClipsHome } from "@/components/create/clips/ClipsHome";
import { ReelCard, type ReelRow } from "@/components/create/promo/Generating";

export default function CreatePage() {
  return <ClipsHome footer={<PromoReels />} />;
}

/** Promo reels the user has made, polled while any is still being made. */
function PromoReels() {
  const [reels, setReels] = useState<ReelRow[] | null>(null);

  useEffect(() => {
    if (isDemo()) return void queueMicrotask(() => setReels([]));
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const load = () =>
      fetch("/api/reels")
        .then((r) => (r.ok ? r.json() : { reels: [] }))
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

  // Nothing to show until there's at least one
  if (!reels?.length) return null;
  return (
    <section className="pt-10">
      <h2 className="font-display text-lg font-semibold tracking-[-0.02em]">Your promo reels</h2>
      <div className="mt-5 flex flex-wrap items-start gap-6">
        {reels.map((r) => (
          <ReelCard key={r.id} reel={r} compact />
        ))}
      </div>
    </section>
  );
}
