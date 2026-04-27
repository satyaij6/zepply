"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import { EngagementChart } from "@/components/dashboard/EngagementChart";
import { NewAutomationModal } from "@/components/dashboard/NewAutomationModal";
import { timeAgo } from "@/lib/utils";
import { Plus, Zap } from "lucide-react";

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

// ── StatCard ──────────────────────────────────────────────────
function StatCard({
  label,
  value,
  trend,
  iconSrc,
}: {
  label: string;
  value: string;
  trend: string;
  iconSrc: string;
}) {
  return (
    <div
      className="bg-white rounded-2xl p-5 flex flex-col gap-2"
      style={{ border: "0.5px solid #D9D9D9" }}
    >
      {/* Label + Icon row */}
      <div className="flex items-start justify-between">
        <p className="text-[13px] font-medium text-[#6B7280]">{label}</p>
        <div className="w-9 h-9 rounded-[10px] bg-[#F5F7FF] flex items-center justify-center flex-shrink-0">
          <Image src={iconSrc} alt={label} width={20} height={20} className="object-contain" />
        </div>
      </div>

      {/* Number */}
      <p className="text-[32px] font-bold text-[#1A1A1A] leading-none">{value}</p>

      {/* Trend */}
      <div className="flex items-center gap-1.5">
        <Image src="/icons/dashboard/trend.png" alt="trend" width={14} height={14} className="object-contain" />
        <span className="text-[12px] font-medium text-[#22C55E]">{trend}</span>
      </div>
    </div>
  );
}

// ── Avatar helpers ────────────────────────────────────────────
const AVATAR_COLORS = [
  { bg: "#FEF3C7", text: "#D97706" },
  { bg: "#EDE9FE", text: "#7C3AED" },
  { bg: "#DCFCE7", text: "#16A34A" },
  { bg: "#FEE2E2", text: "#DC2626" },
  { bg: "#DBEAFE", text: "#1D4ED8" },
  { bg: "#FCE7F3", text: "#DB2777" },
];

function AvatarCircle({ username }: { username: string }) {
  const color = AVATAR_COLORS[username.charCodeAt(0) % AVATAR_COLORS.length];
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold flex-shrink-0"
      style={{ background: color.bg, color: color.text }}
    >
      {username.charAt(0).toUpperCase()}
    </div>
  );
}

// ── Dashboard Page ────────────────────────────────────────────
export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggerStates, setTriggerStates] = useState<Record<string, boolean>>({});
  const [modalOpen, setModalOpen] = useState(false);

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
      <div className="animate-pulse space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-36 bg-white rounded-2xl" style={{ border: "0.5px solid #D9D9D9" }} />
          ))}
        </div>
        <div className="h-80 bg-white rounded-2xl" style={{ border: "0.5px solid #D9D9D9" }} />
      </div>
    );
  }

  const stats = data?.stats ?? { triggersToday: 0, totalLeads: 0, dmsToday: 0, activeTriggers: 0 };
  const leads = data?.recentActivity ?? [];

  // Compute time saved: ~3 min per automated interaction
  const totalInteractions = stats.dmsToday + stats.triggersToday;
  const minutesSaved = Math.round(totalInteractions * 3);
  const timeSavedLabel = minutesSaved >= 60
    ? `${Math.floor(minutesSaved / 60)}h${minutesSaved % 60 > 0 ? ` ${minutesSaved % 60}m` : ""}`
    : `${minutesSaved}m`;

  return (
    <>
      <div className="flex flex-col gap-5">

        {/* ── Row 1: Stat Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="DMs Sent"
            value={stats.dmsToday.toLocaleString()}
            trend="↑15% vs last week"
            iconSrc="/icons/dashboard/sent.png"
          />
          <StatCard
            label="Leads Captured"
            value={stats.totalLeads.toLocaleString()}
            trend="↑32% vs last week"
            iconSrc="/icons/dashboard/leads.png"
          />
          <StatCard
            label="Comments Replied"
            value={stats.triggersToday.toLocaleString()}
            trend="↑12% vs last week"
            iconSrc="/icons/dashboard/comments.png"
          />
          <StatCard
            label="Time Saved"
            value={timeSavedLabel || "0m"}
            trend="↑8% vs last week"
            iconSrc="/icons/dashboard/clock.png"
          />
        </div>

        {/* ── Row 2: Chart + Top Posts ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-5">
          <EngagementChart />

          {/* Top Posts by DMs Triggered */}
          <div className="bg-white rounded-2xl p-6" style={{ border: "0.5px solid #D9D9D9" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[15px] font-medium text-[#1A1A1A]">Top Posts by DMs Triggered</h2>
            </div>
            {[
              { name: "Morning routine reel", date: "Apr 22", dms: 143, leads: 38 },
              { name: "Skincare routine GRWM", date: "Apr 20", dms: 112, leads: 29 },
              { name: "Budget tips for creators", date: "Apr 19", dms: 98, leads: 22 },
              { name: "5-min makeup hack", date: "Apr 17", dms: 77, leads: 18 },
              { name: "My morning affirmations", date: "Apr 15", dms: 64, leads: 14 },
            ].map((post, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5 border-b border-[#F5F5F5] last:border-0">
                {/* Thumbnail placeholder */}
                <div className="w-11 h-11 rounded-lg bg-[#F2F2F2] flex-shrink-0 flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <rect x="2" y="2" width="12" height="12" rx="2" fill="#D9D9D9" />
                    <circle cx="6" cy="6" r="1.5" fill="#B0B0B0" />
                    <path d="M2 11l3.5-3 2.5 2 2-2 4 4" stroke="#B0B0B0" strokeWidth="1" fill="none" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#1A1A1A] truncate">{post.name}</p>
                  <p className="text-[11px] text-[#9CA3AF] mt-0.5">{post.date}</p>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  <span className="text-[11px] font-medium text-[#2564FF] bg-[#EEF3FF] px-2 py-0.5 rounded-full">
                    {post.dms} DMs
                  </span>
                  <span className="text-[11px] font-medium text-[#16A34A] bg-[#DCFCE7] px-2 py-0.5 rounded-full">
                    {post.leads} leads
                  </span>
                </div>
              </div>
            ))}
            <div className="mt-3 text-right">
              <Link href="/dashboard/analytics" className="text-[13px] text-[#2564FF] font-medium hover:underline">
                View all posts →
              </Link>
            </div>
          </div>
        </div>

        {/* ── Row 3: Active Automations + Recent Leads ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[55fr_45fr] gap-5">

          {/* Active Automations */}
          <div className="bg-white rounded-2xl p-6" style={{ border: "0.5px solid #D9D9D9" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[15px] font-medium text-[#1A1A1A]">Active Automations</h2>
              <button
                onClick={() => setModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2564FF] text-white text-[13px] font-medium rounded-full hover:opacity-90 transition-all duration-150 active:scale-90"
              >
                <Plus className="w-3 h-3" /> New
              </button>
            </div>

            {triggers.length === 0 ? (
              /* Demo automations when no real data */
              <>
                {[
                  { label: "Comment-to-DM: 'link'", sub: "Fired 43× today · Last triggered 2m ago", on: true },
                  { label: "Story Reply: Morning routine", sub: "Fired 17× today · Last triggered 8m ago", on: true },
                  { label: "Keyword DM: 'price'", sub: "Fired 9× today · Last triggered 34m ago", on: false },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 py-3 border-b border-[#F5F5F5] last:border-0">
                    {/* Toggle */}
                    <div className={`relative w-9 h-5 rounded-full flex-shrink-0 ${item.on ? "bg-[#2564FF]" : "bg-[#D9D9D9]"}`}>
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${item.on ? "translate-x-4" : "translate-x-0.5"}`} />
                    </div>
                    {/* Icon */}
                    <div className="w-[34px] h-[34px] rounded-[9px] bg-[#EEF3FF] flex items-center justify-center flex-shrink-0">
                      <Zap className="w-4 h-4 text-[#2564FF]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium text-[#1A1A1A] truncate">{item.label}</p>
                      <p className="text-[12px] text-[#9CA3AF] mt-0.5">{item.sub}</p>
                    </div>
                    <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${item.on ? "bg-[#DCFCE7] text-[#16A34A]" : "bg-[#F5F5F5] text-[#6B7280]"
                      }`}>
                      {item.on ? "Running" : "Paused"}
                    </span>
                  </div>
                ))}
              </>
            ) : (
              triggers.map((t) => {
                const on = triggerStates[t.id] ?? t.isActive;
                return (
                  <div key={t.id} className="flex items-center gap-3 py-3 border-b border-[#F5F5F5] last:border-0">
                    <button
                      onClick={() => toggleTrigger(t.id)}
                      className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${on ? "bg-[#2564FF]" : "bg-[#D9D9D9]"}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${on ? "translate-x-4" : "translate-x-0.5"}`} />
                    </button>
                    <div className="w-[34px] h-[34px] rounded-[9px] bg-[#EEF3FF] flex items-center justify-center flex-shrink-0">
                      <Zap className="w-4 h-4 text-[#2564FF]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium text-[#1A1A1A] truncate">
                        {triggerTypeLabel(t.type)}{t.keywords.length > 0 ? `: '${t.keywords[0]}'` : ""}
                      </p>
                      <p className="text-[12px] text-[#9CA3AF] mt-0.5">
                        Fired {t.hitCount}× total · Last updated {timeAgo(t.updatedAt)}
                      </p>
                    </div>
                    <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${on ? "bg-[#DCFCE7] text-[#16A34A]" : "bg-[#F5F5F5] text-[#6B7280]"
                      }`}>
                      {on ? "Running" : "Paused"}
                    </span>
                  </div>
                );
              })
            )}

            <button
              onClick={() => setModalOpen(true)}
              className="mt-4 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[14px] font-medium text-[#2564FF] hover:bg-[#EEF3FF] transition-all duration-150 active:scale-95"
              style={{ border: "1.5px dashed #2564FF" }}
            >
              <Plus className="w-3.5 h-3.5" /> Create New Automation
            </button>
          </div>

          {/* Recent Leads */}
          <div className="bg-white rounded-2xl p-6" style={{ border: "0.5px solid #D9D9D9" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[15px] font-medium text-[#1A1A1A]">Recent Leads</h2>
              <Link href="/dashboard/leads" className="text-[13px] text-[#2564FF] font-medium hover:underline">
                View All →
              </Link>
            </div>

            {leads.length === 0 ? (
              /* Demo leads when no real data */
              <>
                {[
                  { username: "priya_glowup", sub: "Email captured", color: { bg: "#FEF3C7", text: "#D97706" }, ago: "2 min ago" },
                  { username: "styleby_sana", sub: "Phone captured", color: { bg: "#EDE9FE", text: "#7C3AED" }, ago: "7 min ago" },
                  { username: "meera.wellness", sub: "Email captured", color: { bg: "#DCFCE7", text: "#16A34A" }, ago: "14 min ago" },
                  { username: "kaveri_fit", sub: "Email captured", color: { bg: "#FEE2E2", text: "#DC2626" }, ago: "19 min ago" },
                  { username: "disha.bakes", sub: "Phone captured", color: { bg: "#DBEAFE", text: "#1D4ED8" }, ago: "21 min ago" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2.5 py-2.5 border-b border-[#F5F5F5] last:border-0">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold flex-shrink-0"
                      style={{ background: item.color.bg, color: item.color.text }}
                    >
                      {item.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#1A1A1A] truncate">@{item.username}</p>
                      <p className="text-[12px] text-[#9CA3AF] mt-0.5">{item.sub}</p>
                    </div>
                    <span className="text-[12px] text-[#9CA3AF] flex-shrink-0">{item.ago}</span>
                  </div>
                ))}

                {/* Conversion banner */}
                <div className="mt-3 bg-[#FFF7ED] rounded-xl px-3.5 py-2.5 flex items-start gap-2">
                  <span className="text-base leading-none mt-0.5">🔥</span>
                  <div>
                    <p className="text-[13px] font-medium text-[#1A1A1A]">
                      @user_ananya clicked your DM link
                    </p>
                    <p className="text-[11px] text-[#9CA3AF] mt-0.5">Potential conversion · 22 min ago</p>
                  </div>
                </div>
              </>
            ) : (
              <>
                {leads.slice(0, 5).map((item) => (
                  <div key={item.id} className="flex items-center gap-2.5 py-2.5 border-b border-[#F5F5F5] last:border-0">
                    <AvatarCircle username={item.igUsername} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#1A1A1A] truncate">@{item.igUsername}</p>
                      <p className="text-[12px] text-[#9CA3AF] mt-0.5">
                        {item.trigger?.type === "COMMENT" ? "Email captured" :
                          item.trigger?.type === "DM_KEYWORD" ? "Phone captured" : "Lead captured"}
                      </p>
                    </div>
                    <span className="text-[12px] text-[#9CA3AF] flex-shrink-0">{timeAgo(item.capturedAt)}</span>
                  </div>
                ))}

                {leads.length > 0 && (
                  <div className="mt-3 bg-[#FFF7ED] rounded-xl px-3.5 py-2.5 flex items-start gap-2">
                    <span className="text-base leading-none mt-0.5">🔥</span>
                    <div>
                      <p className="text-[13px] font-medium text-[#1A1A1A]">
                        @{leads[0].igUsername} clicked your DM link
                      </p>
                      <p className="text-[11px] text-[#9CA3AF] mt-0.5">Potential conversion · {timeAgo(leads[0].capturedAt)}</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

      </div>

      <NewAutomationModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
