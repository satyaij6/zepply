"use client";

import { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";

const buildData = (period: "7d" | "14d" | "30d") => {
  const now = new Date(2026, 3, 26); // Apr 26 2026
  const days = period === "7d" ? 7 : period === "14d" ? 14 : 30;
  const comments7 = [320, 410, 580, 490, 640, 720, 850];
  const dms7 =      [180, 220, 310, 260, 340, 390, 450];
  const leads7 =    [28,  35,  52,  44,  61,  72,  88];

  return Array.from({ length: days }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (days - 1 - i));
    const label = `Apr ${d.getDate()}`;
    const base = i / (days - 1);
    return {
      label,
      Comments: period === "7d" ? comments7[i] : Math.round(200 + base * 650 + Math.random() * 80),
      DMs:      period === "7d" ? dms7[i]      : Math.round(100 + base * 350 + Math.random() * 40),
      Leads:    period === "7d" ? leads7[i]    : Math.round(15  + base * 73  + Math.random() * 20),
    };
  });
};

const COLORS = { Comments: "#3D7EFF", DMs: "#22C55E", Leads: "#A78BFA" };

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-[#0F1B4C] mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-[#6B7280]">{p.name}:</span>
          <span className="font-semibold text-[#0F1B4C]">{p.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

export function EngagementChart() {
  const [period, setPeriod] = useState<"7d" | "14d" | "30d">("7d");
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const data = buildData(period);

  const toggleSeries = (key: string) =>
    setHidden((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-semibold text-[#0F1B4C]">Engagement Overview</h2>
        <div className="flex gap-1">
          {(["7d", "14d", "30d"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                period === p
                  ? "bg-[#3D7EFF] text-white"
                  : "bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Legend pills */}
      <div className="flex gap-2 mb-5">
        {(Object.keys(COLORS) as Array<keyof typeof COLORS>).map((key) => (
          <button
            key={key}
            onClick={() => toggleSeries(key)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#E5E7EB] text-xs font-medium text-[#374151] bg-white transition-opacity ${
              hidden[key] ? "opacity-40" : "opacity-100"
            }`}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: COLORS[key] }} />
            {key}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="0" stroke="#F3F4F6" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "#9CA3AF", fontSize: 11, fontFamily: "Inter" }}
              axisLine={false}
              tickLine={false}
              interval={period === "30d" ? 4 : period === "14d" ? 1 : 0}
            />
            <YAxis
              tick={{ fill: "#9CA3AF", fontSize: 11, fontFamily: "Inter" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            {(Object.entries(COLORS) as [string, string][]).map(([key, color]) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={color}
                strokeWidth={2}
                dot={false}
                hide={!!hidden[key]}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
