"use client";

import { Check, Circle, Lock } from "lucide-react";

interface OnboardingChecklistProps {
  steps: {
    connectInstagram: boolean;
    createTrigger: boolean;
    getFirstLead: boolean;
    upgradePro: boolean;
  };
}

export function OnboardingChecklist({ steps }: OnboardingChecklistProps) {
  const allDone = steps.connectInstagram && steps.createTrigger && steps.getFirstLead;
  if (allDone) return null;

  const items = [
    { label: "Connect Instagram", done: steps.connectInstagram },
    { label: "Create first trigger", done: steps.createTrigger },
    { label: "Get first lead", done: steps.getFirstLead },
    { label: "Upgrade to Pro", done: false, locked: true },
  ];

  return (
    <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
        Getting Started
      </h3>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-3">
            {item.locked ? (
              <div className="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <Lock className="w-3 h-3 text-gray-400" />
              </div>
            ) : item.done ? (
              <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
              </div>
            ) : (
              <Circle className="w-5 h-5 text-gray-300 dark:text-gray-600" />
            )}
            <span
              className={`text-sm ${
                item.done
                  ? "text-gray-400 line-through"
                  : item.locked
                  ? "text-gray-400 dark:text-gray-500"
                  : "text-gray-700 dark:text-gray-300"
              }`}
            >
              {item.label}
              {item.locked && (
                <span className="text-xs text-gray-400 ml-1">(Pro)</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
