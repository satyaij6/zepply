"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { BarChart3 } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const ranges = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
];

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [range, setRange] = useState("7d");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [range]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics?range=${range}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const dailyData = data?.daily?.map((d: any) => ({
    date: new Date(d.date).toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
    dmsSent: d.dmsSent,
    triggersHit: d.triggersHit,
    leadsCaptured: d.leadsCaptured,
  })) || [];

  const typeData = data?.triggersByType?.map((t: any) => ({
    type: t.type.replace("_", " "),
    hits: t._sum?.hitCount || 0,
  })) || [];

  return (
    <DashboardLayout>
      <PageHeader title="Analytics" description="Track your automation performance." />

      {/* Range selector */}
      <div className="flex gap-2 mb-6">
        {ranges.map((r) => (
          <button
            key={r.value}
            onClick={() => setRange(r.value)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              range === r.value
                ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse" />
          <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse" />
        </div>
      ) : !data || dailyData.length === 0 ? (
        <EmptyState
          icon={<BarChart3 className="w-8 h-8 text-purple-500" />}
          title="No analytics data yet"
          description="Data will appear here once your triggers start firing."
        />
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <p className="text-xs text-gray-400 font-medium">Triggers Fired</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {data.totals.triggersHit}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <p className="text-xs text-gray-400 font-medium">Leads Captured</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {data.totals.leadsCaptured}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <p className="text-xs text-gray-400 font-medium">DMs Sent</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {data.totals.dmsSent}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <p className="text-xs text-gray-400 font-medium">Top Keyword</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                {data.totals.topKeyword}
              </p>
            </div>
          </div>

          {/* DMs Sent Chart */}
          <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 p-5 mb-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
              DMs Sent Over Time
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1f2937",
                      border: "none",
                      borderRadius: "8px",
                      color: "white",
                      fontSize: "13px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="dmsSent"
                    stroke="#6C3AE8"
                    strokeWidth={2}
                    dot={{ fill: "#6C3AE8", r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Triggers by Type */}
          {typeData.length > 0 && (
            <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 p-5 mb-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                Triggers Fired by Type
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={typeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="type" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1f2937",
                        border: "none",
                        borderRadius: "8px",
                        color: "white",
                        fontSize: "13px",
                      }}
                    />
                    <Bar dataKey="hits" fill="#6C3AE8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Top Triggers Table */}
          {data.topTriggers?.length > 0 && (
            <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                Top Triggers
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-400 border-b border-gray-200 dark:border-gray-800">
                      <th className="pb-3 font-medium">Type</th>
                      <th className="pb-3 font-medium">Keywords</th>
                      <th className="pb-3 font-medium text-right">Hits</th>
                      <th className="pb-3 font-medium text-right">Leads</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {data.topTriggers.map((t: any) => (
                      <tr key={t.id}>
                        <td className="py-3">{t.type.replace("_", " ")}</td>
                        <td className="py-3 text-gray-500">{t.keywords.join(", ") || "—"}</td>
                        <td className="py-3 text-right font-medium">{t.hitCount}</td>
                        <td className="py-3 text-right font-medium">{t._count?.leads || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  );
}
