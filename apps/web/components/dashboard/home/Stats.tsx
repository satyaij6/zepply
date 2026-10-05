import { useId } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import BrandIcon from "@/components/landing/home/BrandIcon";
import type { HomeData } from "@/types/dashboard";
import { compact, number, sum, type Metric } from "./ui";

const WEEKLY: { metric: Metric; label: string }[] = [
  { metric: "dmsSent", label: "DMs sent" },
  { metric: "leadsCaptured", label: "Leads captured" },
  { metric: "triggersHit", label: "Automations fired" },
];

/** Followers plus three weekly numbers, each compared with the week before and drawn as a 14-day sparkline. */
export function Stats({ data }: { data: HomeData }) {
  const { igAccount, days } = data;
  const thisWeek = days.slice(-7);
  const lastWeek = days.slice(-14, -7);

  return (
    <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
      <Stat
        label="Followers"
        value={igAccount ? compact(igAccount.followerCount) : "—"}
        footer={<span className="text-xs text-app-faint">{igAccount ? "Live from Instagram" : "Connect Instagram to see this"}</span>}
        figure={<BrandIcon brand="instagram" size={26} />}
      />
      {WEEKLY.map(({ metric, label }) => (
        <Stat
          key={metric}
          label={label}
          value={number(sum(thisWeek, metric))}
          period="7 days"
          footer={<Delta current={sum(thisWeek, metric)} previous={sum(lastWeek, metric)} />}
          figure={<Sparkline values={days.slice(-14).map((d) => d[metric])} />}
        />
      ))}
    </div>
  );
}

function Stat({ label, period, value, footer, figure }: { label: string; period?: string; value: string; footer: React.ReactNode; figure: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-app-line bg-app-card p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-app-muted">{label}</p>
        {period && <span className="text-[11px] text-app-faint">{period}</span>}
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-[34px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{value}</p>
          <div className="mt-3">{footer}</div>
        </div>
        <div className="shrink-0">{figure}</div>
      </div>
    </div>
  );
}

function Delta({ current, previous }: { current: number; previous: number }) {
  if (!current && !previous) return <span className="text-xs text-app-faint">No activity yet</span>;
  if (!previous) return <span className="rounded-full bg-electric-wash px-2 py-0.5 text-xs font-semibold text-electric-deep">New this week</span>;

  const change = Math.round(((current - previous) / previous) * 100);
  const up = change >= 0;
  return (
    <span className="flex items-center gap-2">
      <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${up ? "bg-[#E3F5EC] text-[#0E8A5F]" : "bg-[#FDECE7] text-[#C2410C]"}`}>
        {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
        {Math.abs(change)}%
      </span>
      <span className="text-xs text-app-faint">vs last week</span>
    </span>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const id = useId().replace(/:/g, "");
  const w = 112;
  const h = 40;
  const max = Math.max(...values, 1);
  const points = values.map((v, i) => [(i / (values.length - 1)) * w, h - 3 - (v / max) * (h - 8)]);
  const line = points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-10 w-28" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#3D7EFF" stopOpacity="0.22" />
          <stop offset="1" stopColor="#3D7EFF" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w} ${h} L0 ${h} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke="#3D7EFF" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
