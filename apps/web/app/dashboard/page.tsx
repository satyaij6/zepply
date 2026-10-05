"use client";

import { useCallback, useEffect, useState } from "react";
import { isDemo, useShellUser } from "@/components/layout/DashboardLayout";
import { Activity } from "@/components/dashboard/home/Activity";
import { Automations } from "@/components/dashboard/home/Automations";
import { Growth } from "@/components/dashboard/home/Growth";
import { Hero } from "@/components/dashboard/home/Hero";
import { Accounts, ComingNext } from "@/components/dashboard/home/Rail";
import { Stats } from "@/components/dashboard/home/Stats";
import type { HomeData } from "@/types/dashboard";

export default function DashboardHome() {
  const user = useShellUser();
  const [data, setData] = useState<HomeData | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    const demo = isDemo() ? `?demo=${new URLSearchParams(window.location.search).get("demo") || "1"}` : "";
    return fetch(`/api/dashboard/home${demo}`)
      .then((r) => {
        // Signed out: send them to log in rather than showing an error
        if (r.status === 401) window.location.replace("/login");
        return r.ok ? r.json() : Promise.reject(r.status);
      })
      .then((d: HomeData) => {
        setData(d);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (failed && !data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <p className="font-display text-xl font-semibold">We couldn&apos;t load your dashboard</p>
        <p className="mt-2 text-sm text-app-muted">Check your connection and try again.</p>
        <button type="button" onClick={load} className="mt-5 h-10 rounded-xl bg-app-ink px-5 text-sm font-semibold text-white">
          Try again
        </button>
      </div>
    );
  }

  if (!data) return <Skeleton />;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 pt-2 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-6">
        <Hero name={user?.name} data={data} />
        <Stats data={data} />
        <Growth days={data.days} />
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 2xl:grid-cols-2">
          <Automations data={data} demo={isDemo()} />
          <Activity data={data} />
        </div>
      </div>
      <aside className="space-y-6">
        <Accounts data={data} />
        <ComingNext />
      </aside>
    </div>
  );
}

function Skeleton() {
  const block = "animate-pulse rounded-3xl bg-app-line/60";
  return (
    <div aria-busy="true" aria-label="Loading your dashboard" className="grid gap-6 pt-2 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        <div className={`${block} h-64`} />
        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`${block} h-36`} />
          ))}
        </div>
        <div className={`${block} h-96`} />
      </div>
      <div className="space-y-6">
        <div className={`${block} h-80`} />
        <div className={`${block} h-72`} />
      </div>
    </div>
  );
}
