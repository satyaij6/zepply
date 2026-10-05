"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import type { DayStat } from "@/types/dashboard";
import { Card, CardHeader, number, sum, type Metric } from "./ui";

const METRICS: { metric: Metric; label: string; noun: string }[] = [
  { metric: "dmsSent", label: "DMs sent", noun: "DMs sent" },
  { metric: "leadsCaptured", label: "Leads", noun: "leads captured" },
  { metric: "triggersHit", label: "Automations fired", noun: "automations fired" },
];
const RANGES = [7, 30] as const;

/** Rounds up to a tidy axis maximum: 1, 2 or 5 × a power of ten. */
function niceMax(n: number) {
  if (n <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(n));
  return ([1, 2, 5, 10].find((m) => m * p >= n) ?? 10) * p;
}

export function Growth({ days }: { days: DayStat[] }) {
  const [metric, setMetric] = useState<Metric>("dmsSent");
  const [range, setRange] = useState<(typeof RANGES)[number]>(30);
  const shown = days.slice(-range);
  const max = niceMax(Math.max(...shown.map((d) => d[metric])));
  const total = sum(shown, metric);
  const noun = METRICS.find((m) => m.metric === metric)!.noun;

  return (
    <Card className="p-6">
      <CardHeader title="Growth overview">
        <Segmented options={RANGES.map((r) => ({ value: r, label: `${r}D` }))} value={range} onChange={setRange} label="Date range" />
      </CardHeader>

      <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <p className="text-sm text-app-muted">
          <span className="font-display text-3xl font-semibold tracking-[-0.03em] text-app-ink tabular-nums">{number(total)}</span>
          <span className="ml-2">
            {noun} in the last {range} days
          </span>
        </p>
        <Segmented options={METRICS.map((m) => ({ value: m.metric, label: m.label }))} value={metric} onChange={setMetric} label="Metric" />
      </div>

      <div className="relative mt-6 h-56">
        {[1, 0.5, 0].map((f) => (
          <div key={f} className="absolute inset-x-0 flex items-center gap-3" style={{ top: `${(1 - f) * 100}%` }}>
            <span className="w-8 -translate-y-1/2 text-right text-[11px] tabular-nums text-app-faint">{number(Math.round(max * f))}</span>
            <span className="h-px flex-1 -translate-y-1/2 border-t border-dashed border-app-line" />
          </div>
        ))}
        <div className={`absolute inset-y-0 left-11 right-0 flex items-end ${range === 7 ? "gap-5 px-3" : "gap-1.5"}`}>
          {shown.map((d) => (
            <div key={d.date} className="group relative flex h-full flex-1 items-end">
              <motion.div
                className="w-full rounded-t-lg bg-linear-to-t from-electric/70 to-electric group-hover:from-electric-deep group-hover:to-electric-deep"
                initial={false}
                animate={{ height: `${Math.max((d[metric] / max) * 100, 1.5)}%` }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              />
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-app-ink px-2.5 py-1.5 text-xs text-white opacity-0 transition group-hover:opacity-100">
                <b className="font-semibold tabular-nums">{number(d[metric])}</b> · {label(d.date)}
              </span>
            </div>
          ))}
        </div>
        {total === 0 && (
          <p className="absolute inset-0 flex items-center justify-center pl-11 text-sm text-app-muted">Your chart fills in as your automations run.</p>
        )}
      </div>
      {/* Labels are centred under their bar without taking up width, so they can't widen the row */}
      <div className={`ml-11 mt-2 flex h-4 ${range === 7 ? "gap-5 px-3" : "gap-1.5"}`}>
        {shown.map((d, i) => (
          <span key={d.date} className="relative min-w-0 flex-1">
            {(range === 7 || i % 5 === 4) && (
              <span className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] text-app-faint ${range === 30 && i % 10 !== 9 ? "max-sm:hidden" : ""}`}>{label(d.date)}</span>
            )}
          </span>
        ))}
      </div>
    </Card>
  );
}

const label = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

function Segmented<T extends string | number>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-xl bg-app-bg p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition ${o.value === value ? "bg-app-card text-app-ink shadow-sm" : "text-app-muted hover:text-app-ink"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
