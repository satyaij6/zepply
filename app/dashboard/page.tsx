"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { EngagementChart } from "@/components/dashboard/EngagementChart";
import { timeAgo } from "@/lib/utils";
import {
  MessageSquare, Users, Zap, TrendingUp, Plus, Download,
  BarChart2, Calendar,
} from "lucide-react";

// ── Sparkline SVG paths (decorative) ─────────────────────────
const sparklines = [
  // DMs
  "M0 22 C10 20, 18 18, 26 15 C34 12, 40 16, 50 12 C60 8, 68 10, 78 6 L90 4",
  // Leads
  "M0 24 C15 22, 20 20, 30 17 C40 14, 45 18, 55 13 C65 8, 72 11, 80 7 L90 3",
  // Comments
  "M0 20 C12 18, 22 21, 32 16 C42 11, 50 17, 60 12 C70 7, 76 9, 85 5 L90 4",
  // Revenue
  "M0 26 C8 24, 18 22, 28 18 C38 14, 46 19, 56 14 C66 9, 74 12, 82 7 L90 3",
];

function Sparkline({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 90 28" preserveAspectRatio="none" className="w-full h-7 mt-3 block">
      <defs>
        <linearGradient id={`sg-${path.slice(0, 6)}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3D7EFF" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#3D7EFF" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`${path} L90 28 L0 28Z`}
        fill={`url(#sg-${path.slice(0, 6)})`}
      />
      <path d={path} fill="none" stroke="#3D7EFF" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

// ── StatCard ──────────────────────────────────────────────────
function StatCard({
  label, value, trend, icon, sparkIdx, unique,
}: {
  label: string; value: string; trend: string; icon: React.ReactNode;
  sparkIdx: number; unique?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 hover:bg-[#FAFBFF] transition-colors">
      <div className="w-9 h-9 rounded-[10px] bg-[#EEF2FF] flex items-center justify-center mb-3 text-[#3D7EFF]">
        {icon}
      </div>
      <p className="text-[11px] font-medium text-[#9CA3AF] uppercase tracking-[0.5px] mb-1.5">{label}</p>
      <p className="text-[32px] font-extrabold text-[#0F1B4C] leading-none mb-2">{value}</p>
      <div className="flex items-center gap-1 text-[12px] font-medium text-[#22C55E] mb-1">
        <TrendingUp className="w-3 h-3" />
        {trend}
      </div>
      {unique && (
        <span className="inline-flex items-center text-[10px] font-semibold text-[#3D7EFF] bg-[#EEF2FF] px-2 py-0.5 rounded-full mt-1">
          ✦ Unique to Zepply
        </span>
      )}
      <Sparkline path={sparklines[sparkIdx]} />
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────
interface DashboardData {
  stats: { triggersToday: number; totalLeads: number; dmsToday: number; activeTriggers: number };
  igAccount: { igUsername: string; igProfilePic?: string | null; followerCount: number } | null;
  recentActivity: Array<{
    id: string; igUsername: string; capturedAt: string;
    trigger?: { type: string; keywords: string[] } | null;
  }>;
  onboarding: { connectInstagram: boolean; createTrigger: boolean; getFirstLead: boolean; upgradePro: boolean };
}

interface Trigger {
  id: string; type: string; keywords: string[]; replyMessage: string;
  isActive: boolean; hitCount: number; updatedAt: string;
}

// ── Dashboard Page ────────────────────────────────────────────
export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggerStates, setTriggerStates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard/stats").then((r) => r.ok ? r.json() : null),
      fetch("/api/triggers").then((r) => r.ok ? r.json() : []),
    ]).then(([stats, trigs]) => {
      if (stats) setData(stats);
      const tList = Array.isArray(trigs) ? trigs : (trigs?.triggers ?? []);
      setTriggers(tList.slice(0, 3));
      const states: Record<string, boolean> = {};
      tList.forEach((t: Trigger) => { states[t.id] = t.isActive; });
      setTriggerStates(states);
    }).finally(() => setLoading(false));
  }, []);

  const toggleTrigger = async (id: string) => {
    const next = !triggerStates[id];
    setTriggerStates((prev) => ({ ...prev, [id]: next }));
    await fetch(`/api/triggers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: next }),
    }).catch(() => setTriggerStates((prev) => ({ ...prev, [id]: !next })));
  };

  const triggerTypeLabel = (type: string) => ({
    COMMENT: "Comment-to-DM",
    DM_KEYWORD: "Keyword DM",
    STORY_REPLY: "Story Reply",
    NEW_FOLLOWER: "New Follower",
  }[type] ?? type);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="animate-pulse space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1,2,3,4].map((i) => <div key={i} className="h-44 bg-white rounded-2xl border border-[#E5E7EB]" />)}
          </div>
          <div className="h-80 bg-white rounded-2xl border border-[#E5E7EB]" />
        </div>
      </DashboardLayout>
    );
  }

  const stats = data?.stats ?? { triggersToday: 0, totalLeads: 0, dmsToday: 0, activeTriggers: 0 };
  const leads = data?.recentActivity ?? [];

  return (
    <DashboardLayout igAccount={data?.igAccount}>
      <div className="flex flex-col gap-5">

        {/* ── Row 1: Stat Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="DMs Sent"
            value={stats.dmsToday.toLocaleString()}
            trend="↑ 18% vs last week"
            icon={<MessageSquare className="w-4.5 h-4.5" />}
            sparkIdx={0}
          />
          <StatCard
            label="Leads Captured"
            value={stats.totalLeads.toLocaleString()}
            trend="↑ 32% vs last week"
            icon={<Users className="w-4.5 h-4.5" />}
            sparkIdx={1}
          />
          <StatCard
            label="Comments Replied"
            value={stats.triggersToday.toLocaleString()}
            trend="↑ 12% vs last week"
            icon={<Zap className="w-4.5 h-4.5" />}
            sparkIdx={2}
          />
          <StatCard
            label="Revenue Attributed"
            value="₹0"
            trend="↑ 41% vs last week"
            icon={<TrendingUp className="w-4.5 h-4.5" />}
            sparkIdx={3}
            unique
          />
        </div>

        {/* ── Row 2: Chart + Top Posts ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-5">
          <EngagementChart />

          {/* Top Posts */}
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[15px] font-semibold text-[#0F1B4C]">Top Posts by DMs Triggered</h2>
            </div>
            {[
              { name: "Morning routine reel", date: "Apr 22", dms: 143, leads: 38 },
              { name: "Skincare routine GRWM", date: "Apr 20", dms: 112, leads: 29 },
              { name: "Budget tips for creators", date: "Apr 19", dms: 98, leads: 22 },
              { name: "5-min makeup hack", date: "Apr 17", dms: 77, leads: 18 },
              { name: "My morning affirmations", date: "Apr 15", dms: 64, leads: 14 },
            ].map((post, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5 border-b border-[#F3F4F6] last:border-0">
                <div className="w-11 h-11 rounded-lg bg-[#E5E7EB] flex-shrink-0 flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <rect x="2" y="2" width="12" height="12" rx="2" fill="#D1D5DB"/>
                    <circle cx="6" cy="6" r="1.5" fill="#9CA3AF"/>
                    <path d="M2 11l3.5-3 2.5 2 2-2 4 4" fill="#9CA3AF"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[#0F1B4C] truncate">{post.name}</p>
                  <p className="text-[12px] text-[#9CA3AF] mt-0.5">{post.date}</p>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  <span className="text-[11px] font-semibold text-[#3D7EFF] bg-[#EEF2FF] px-2 py-0.5 rounded-full">{post.dms} DMs</span>
                  <span className="text-[11px] font-semibold text-[#16A34A] bg-[#DCFCE7] px-2 py-0.5 rounded-full">{post.leads} leads</span>
                </div>
              </div>
            ))}
            <div className="mt-3 text-right">
              <Link href="/dashboard/analytics" className="text-[13px] text-[#3D7EFF] font-medium hover:underline">
                View all posts →
              </Link>
            </div>
          </div>
        </div>

        {/* ── Row 3: Active Automations + Recent Leads ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[55fr_45fr] gap-5">

          {/* Active Automations */}
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[15px] font-semibold text-[#0F1B4C]">Active Automations</h2>
              <Link
                href="/dashboard/triggers"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3D7EFF] text-white text-[13px] font-semibold rounded-full hover:opacity-90 transition-opacity"
              >
                <Plus className="w-3 h-3" /> New
              </Link>
            </div>

            {triggers.length === 0 ? (
              <p className="text-sm text-[#9CA3AF] py-4 text-center">
                No automations yet.{" "}
                <Link href="/dashboard/triggers" className="text-[#3D7EFF]">Create your first →</Link>
              </p>
            ) : (
              triggers.map((t) => {
                const on = triggerStates[t.id] ?? t.isActive;
                return (
                  <div key={t.id} className="flex items-center gap-3 py-3 border-b border-[#F3F4F6] last:border-0">
                    {/* Toggle */}
                    <button
                      onClick={() => toggleTrigger(t.id)}
                      className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${on ? "bg-[#3D7EFF]" : "bg-[#D1D5DB]"}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${on ? "translate-x-4" : "translate-x-0.5"}`} />
                    </button>
                    <div className="w-[34px] h-[34px] rounded-[9px] bg-[#EEF2FF] flex items-center justify-center flex-shrink-0 text-[#3D7EFF]">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-[#0F1B4C] truncate">
                        {triggerTypeLabel(t.type)}{t.keywords.length > 0 ? `: '${t.keywords[0]}'` : ""}
                      </p>
                      <p className="text-[12px] text-[#9CA3AF] mt-0.5">
                        Fired {t.hitCount}× total · Last updated {timeAgo(t.updatedAt)}
                      </p>
                    </div>
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                      on ? "bg-[#DCFCE7] text-[#16A34A]" : "bg-[#F3F4F6] text-[#6B7280]"
                    }`}>
                      {on ? "Running" : "Paused"}
                    </span>
                  </div>
                );
              })
            )}

            <Link
              href="/dashboard/triggers"
              className="mt-4 w-full flex items-center justify-center gap-1.5 py-2.5 border-[1.5px] border-dashed border-[#3D7EFF] rounded-xl text-[14px] font-semibold text-[#3D7EFF] hover:bg-[#EEF2FF] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Create New Automation
            </Link>
          </div>

          {/* Recent Leads */}
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[15px] font-semibold text-[#0F1B4C]">Recent Leads</h2>
              <Link href="/dashboard/leads" className="text-[13px] text-[#3D7EFF] font-medium hover:underline">
                View All →
              </Link>
            </div>

            {leads.length === 0 ? (
              <p className="text-sm text-[#9CA3AF] py-4 text-center">No leads yet. Your first trigger will capture them!</p>
            ) : (
              leads.slice(0, 5).map((item) => {
                const colors = ["#F59E0B","#3D7EFF","#22C55E","#EF4444","#8B5CF6","#EC4899"];
                const color = colors[item.igUsername.charCodeAt(0) % colors.length];
                return (
                  <div key={item.id} className="flex items-center gap-2.5 py-2.5 border-b border-[#F3F4F6] last:border-0">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ background: color }}
                    >
                      {item.igUsername.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-[#0F1B4C] truncate">@{item.igUsername}</p>
                      <p className="text-[12px] text-[#9CA3AF] mt-0.5">
                        {item.trigger?.type === "COMMENT" ? "Comment" :
                         item.trigger?.type === "DM_KEYWORD" ? "DM keyword" :
                         item.trigger?.type === "STORY_REPLY" ? "Story reply" : "New follower"}
                      </p>
                    </div>
                    <span className="text-[12px] text-[#9CA3AF] flex-shrink-0">{timeAgo(item.capturedAt)}</span>
                  </div>
                );
              })
            )}

            {leads.length > 0 && (
              <div className="mt-3 bg-[#F0FDF4] rounded-xl px-3.5 py-2.5">
                <p className="text-[13px] font-semibold text-[#16A34A]">🎉 Automation is working!</p>
                <p className="text-[12px] text-[#9CA3AF] mt-0.5">
                  {leads.length} lead{leads.length !== 1 ? "s" : ""} captured so far
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Row 4: Recent Conversations ── */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-[15px] font-semibold text-[#0F1B4C]">Recent AI Conversations</h2>
            <Link href="/dashboard/leads" className="text-[13px] text-[#3D7EFF] font-medium hover:underline">
              View All in Inbox →
            </Link>
          </div>

          {leads.length === 0 ? (
            <p className="text-sm text-[#9CA3AF] py-6 text-center">No conversations yet.</p>
          ) : (
            leads.slice(0, 3).map((item) => {
              const colors = ["#3D7EFF","#F59E0B","#22C55E","#EF4444","#8B5CF6"];
              const color = colors[item.igUsername.charCodeAt(0) % colors.length];
              const typeText = {
                COMMENT: "commented on your post",
                DM_KEYWORD: "sent you a DM",
                STORY_REPLY: "replied to your story",
                NEW_FOLLOWER: "followed you",
              }[item.trigger?.type ?? "COMMENT"] ?? "interacted";
              const keyword = item.trigger?.keywords?.[0];
              return (
                <div key={item.id} className="flex items-start gap-3 py-3.5 border-b border-[#F3F4F6] last:border-0">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0"
                    style={{ background: color }}
                  >
                    {item.igUsername.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-[#0F1B4C]">@{item.igUsername}</p>
                    <p className="text-[13px] text-[#6B7280] mt-0.5">
                      {typeText}{keyword ? ` with "${keyword}"` : ""}
                    </p>
                    <p className="text-[13px] text-[#3D7EFF] italic mt-0.5 truncate">
                      Zepply replied: Auto-reply sent via your trigger ✓
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[12px] text-[#22C55E] font-medium">✓ Sent</p>
                    <p className="text-[12px] text-[#9CA3AF] mt-0.5">{timeAgo(item.capturedAt)}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Row 5: Quick Actions ── */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/dashboard/triggers"
              className="flex items-center gap-1.5 px-5 py-2.5 bg-[#3D7EFF] text-white rounded-full text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              <Zap className="w-3.5 h-3.5" /> New Automation
            </Link>
            <button className="flex items-center gap-1.5 px-5 py-2.5 bg-white text-[#0F1B4C] border border-[#E5E7EB] rounded-full text-sm font-medium hover:bg-[#F9FAFB] transition-colors">
              <Calendar className="w-3.5 h-3.5" /> Schedule Post + DM
            </button>
            <Link
              href="/dashboard/leads/export"
              className="flex items-center gap-1.5 px-5 py-2.5 bg-white text-[#0F1B4C] border border-[#E5E7EB] rounded-full text-sm font-medium hover:bg-[#F9FAFB] transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Export Leads
            </Link>
            <Link
              href="/dashboard/analytics"
              className="flex items-center gap-1.5 px-5 py-2.5 bg-white text-[#0F1B4C] border border-[#E5E7EB] rounded-full text-sm font-medium hover:bg-[#F9FAFB] transition-colors"
            >
              <BarChart2 className="w-3.5 h-3.5" /> View Full Report
            </Link>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
