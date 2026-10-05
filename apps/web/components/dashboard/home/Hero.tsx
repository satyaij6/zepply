import Link from "next/link";
import { ArrowRight, Check, Plus } from "lucide-react";
import type { HomeData } from "@/types/dashboard";
import { number, sum } from "./ui";

/** Dark welcome banner: greeting and main actions, with setup progress or (once set up) this week's totals. */
export function Hero({ name, data }: { name?: string | null; data: HomeData }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
  const { onboarding } = data;
  const setUp = onboarding.connectInstagram && onboarding.createAutomation && onboarding.firstLead;

  return (
    <section className="relative overflow-hidden rounded-[28px] bg-app-side text-white">
      <div
        aria-hidden
        className="absolute -right-[10%] -top-[60%] h-[180%] w-[70%] animate-[glow-drift-a_26s_ease-in-out_infinite_alternate] motion-reduce:animate-none"
        style={{ background: "radial-gradient(closest-side, rgba(61,126,255,0.32), rgba(61,126,255,0))" }}
      />
      <div aria-hidden className="absolute -bottom-1/2 -left-[10%] h-full w-1/2" style={{ background: "radial-gradient(closest-side, rgba(80,70,210,0.18), rgba(80,70,210,0))" }} />

      <div className="relative grid gap-8 p-7 sm:p-9 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-center lg:gap-8">
        <div>
          <p className="text-sm text-zinc-400">{today}</p>
          <h1 className="mt-3 font-display text-[clamp(30px,3.2vw,44px)] font-semibold leading-[1.08] tracking-[-0.03em]">
            {greeting}
            {name && (
              <>
                , <span className="font-serif text-[1.1em] font-normal italic tracking-[-0.01em] text-silver">{name}</span>
              </>
            )}
          </h1>
          <p className="mt-3 max-w-[460px] text-base leading-relaxed text-zinc-400">
            {setUp ? "Here’s how your automations are doing this week." : "A few steps and your first automation goes live."}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/dashboard/triggers/new" className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-app-ink transition hover:bg-zinc-200">
              <Plus className="h-4 w-4" /> New automation
            </Link>
            <Link href="/dashboard/leads" className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-semibold text-white transition hover:bg-white/[0.06]">
              View leads <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {setUp ? <WeekSummary data={data} /> : <Checklist onboarding={onboarding} />}
      </div>
    </section>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur">{children}</div>;
}

function Checklist({ onboarding }: { onboarding: HomeData["onboarding"] }) {
  const steps = [
    { done: onboarding.connectInstagram, label: "Connect Instagram", href: "/api/instagram/connect" },
    { done: onboarding.createAutomation, label: "Create your first automation", href: "/dashboard/triggers/new" },
    { done: onboarding.firstLead, label: "Capture your first lead", hint: "Happens when someone uses your keyword" },
  ];
  const done = steps.filter((s) => s.done).length;
  const next = steps.findIndex((s) => !s.done);

  return (
    <Panel>
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold">Get set up</p>
        <p className="text-xs text-zinc-400">
          {done} of {steps.length} done
        </p>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-electric transition-[width] duration-700" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className="mt-4 space-y-1">
        {steps.map((step, i) => {
          const row = (
            <>
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${step.done ? "bg-electric text-white" : "border border-white/25"}`}>
                {step.done && <Check className="h-3 w-3" strokeWidth={3} />}
              </span>
              <span className="min-w-0">
                <span className={`block text-sm ${step.done ? "text-zinc-500" : "text-white"}`}>{step.label}</span>
                {i === next && step.hint && <span className="block text-xs text-zinc-500">{step.hint}</span>}
              </span>
              {i === next && step.href && <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-zinc-400" />}
            </>
          );
          const cls = `flex items-center gap-3 rounded-xl px-2 py-2 ${i === next ? "bg-white/[0.06]" : ""}`;
          return (
            <li key={step.label}>
              {i === next && step.href ? (
                <a href={step.href} className={`${cls} transition hover:bg-white/[0.1]`}>
                  {row}
                </a>
              ) : (
                <div className={cls}>{row}</div>
              )}
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

function WeekSummary({ data }: { data: HomeData }) {
  const week = data.days.slice(-7);
  const rows = [
    { label: "DMs sent", value: sum(week, "dmsSent") },
    { label: "Leads captured", value: sum(week, "leadsCaptured") },
    { label: "Automations fired", value: sum(week, "triggersHit") },
  ];
  return (
    <Panel>
      <p className="text-sm font-semibold">Last 7 days</p>
      <dl className="mt-3 divide-y divide-white/10">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex items-baseline justify-between py-2.5">
            <dt className="text-sm text-zinc-400">{label}</dt>
            <dd className="font-display text-xl font-semibold tabular-nums">{number(value)}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}
