"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { OnboardingChecklist } from "@/components/dashboard/OnboardingChecklist";
import { PlanBadge } from "@/components/shared/PlanBadge";
import { Zap, Users, Send, Activity } from "lucide-react";
import Link from "next/link";

interface DashboardData {
  stats: {
    triggersToday: number;
    totalLeads: number;
    dmsToday: number;
    activeTriggers: number;
  };
  igAccount: {
    igUsername: string;
    igProfilePic?: string | null;
    followerCount: number;
  } | null;
  recentActivity: any[];
  onboarding: {
    connectInstagram: boolean;
    createTrigger: boolean;
    getFirstLead: boolean;
    upgradePro: boolean;
  };
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await fetch("/api/dashboard/stats");
      if (res.ok) {
        setData(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  // Show loading skeleton
  if (loading) {
    return (
      <DashboardLayout igAccount={null}>
        <div className="animate-pulse space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 bg-gray-200 dark:bg-gray-800 rounded-xl" />
            ))}
          </div>
          <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-xl" />
        </div>
      </DashboardLayout>
    );
  }

  const stats = data?.stats || { triggersToday: 0, totalLeads: 0, dmsToday: 0, activeTriggers: 0 };
  const onboarding = data?.onboarding || { connectInstagram: false, createTrigger: false, getFirstLead: false, upgradePro: false };

  return (
    <DashboardLayout igAccount={data?.igAccount}>
      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard
          label="Triggers Today"
          value={stats.triggersToday}
          icon={<Zap className="w-5 h-5" />}
        />
        <StatsCard
          label="Total Leads"
          value={stats.totalLeads}
          icon={<Users className="w-5 h-5" />}
        />
        <StatsCard
          label="DMs Sent Today"
          value={stats.dmsToday}
          icon={<Send className="w-5 h-5" />}
        />
        <StatsCard
          label="Active Triggers"
          value={stats.activeTriggers}
          icon={<Activity className="w-5 h-5" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Actions */}
          <div className="flex gap-3">
            <Link
              href="/dashboard/triggers"
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
            >
              + Add Trigger
            </Link>
            <Link
              href="/dashboard/leads"
              className="px-4 py-2 text-sm font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
            >
              View Leads
            </Link>
          </div>

          {/* Activity Feed */}
          <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
              Recent Activity
            </h2>
            <ActivityFeed items={data?.recentActivity || []} />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Connected Account */}
          {data?.igAccount && (
            <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Connected Account
              </h3>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center overflow-hidden">
                  {data.igAccount.igProfilePic ? (
                    <img
                      src={data.igAccount.igProfilePic}
                      alt={data.igAccount.igUsername}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-lg font-bold text-purple-600">
                      {data.igAccount.igUsername.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">
                    @{data.igAccount.igUsername}
                  </p>
                  <p className="text-xs text-gray-400">
                    {data.igAccount.followerCount.toLocaleString()} followers
                  </p>
                </div>
                <PlanBadge plan="FREE" className="ml-auto" />
              </div>
            </div>
          )}

          {/* Onboarding Checklist */}
          <OnboardingChecklist steps={onboarding} />
        </div>
      </div>
    </DashboardLayout>
  );
}
