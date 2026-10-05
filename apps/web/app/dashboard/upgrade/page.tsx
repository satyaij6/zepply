"use client";

// Stub upgrade page for Phase 1 — will be fully built in Phase 2 with payments

import { PageHeader } from "@/components/shared/PageHeader";
import { Check, Lock } from "lucide-react";

const freeFeatures = [
  "Unlimited comment triggers",
  "Unlimited DM keyword triggers",
  "Welcome message for new followers",
  "Lead capture & export",
  "Basic analytics",
];

const proFeatures = [
  "Everything in Free",
  "AI-powered replies (Claude Opus)",
  "WhatsApp handoff automation",
  "Brand voice training",
  "Hindi + English auto-detect",
  "Priority support",
];

export default function UpgradePage() {
  return (
    <>
      <PageHeader title="Upgrade to Pro" description="Unlock AI replies and WhatsApp handoff." />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
        {/* Free */}
        <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <div className="mb-6">
            <span className="px-2.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full text-xs font-semibold">
              FREE
            </span>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-3">₹0</p>
            <p className="text-sm text-gray-400 mt-1">Forever free</p>
          </div>
          <div className="space-y-3">
            {freeFeatures.map((f) => (
              <div key={f} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Check className="w-4 h-4 text-green-500 flex-shrink-0" /> {f}
              </div>
            ))}
          </div>
          <button
            disabled
            className="w-full mt-6 px-4 py-2.5 text-sm font-medium text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-lg cursor-not-allowed"
          >
            Current Plan
          </button>
        </div>

        {/* Pro */}
        <div className="bg-white dark:bg-gray-950 rounded-xl border-2 border-purple-500 p-6 relative">
          <span className="absolute -top-3 right-4 px-3 py-0.5 bg-purple-600 text-white text-xs font-semibold rounded-full">
            COMING SOON
          </span>
          <div className="mb-6">
            <span className="px-2.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-xs font-semibold">
              PRO
            </span>
            <p className="text-3xl font-bold text-gray-900 dark:text-white mt-3">₹799<span className="text-sm font-normal text-gray-400">/mo</span></p>
            <p className="text-sm text-gray-400 mt-1">or ₹6,399/year (save 33%)</p>
          </div>
          <div className="space-y-3">
            {proFeatures.map((f) => (
              <div key={f} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Check className="w-4 h-4 text-purple-500 flex-shrink-0" /> {f}
              </div>
            ))}
          </div>
          <button
            disabled
            className="w-full mt-6 px-4 py-2.5 text-sm font-medium text-white bg-purple-400 rounded-lg cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Lock className="w-4 h-4" /> Coming in Phase 2
          </button>
        </div>
      </div>
    </>
  );
}
