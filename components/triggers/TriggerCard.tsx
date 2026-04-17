"use client";

import { truncate } from "@/lib/utils";
import { TriggerTypeBadge } from "./TriggerTypeSelector";
import { Link as LinkIcon, Shield, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";

interface TriggerCardProps {
  trigger: {
    id: string;
    type: string;
    keywords: string[];
    replyMessage: string;
    deliverLink?: string | null;
    followGate: boolean;
    isActive: boolean;
    hitCount: number;
    _count?: { leads: number };
  };
  onToggle: (id: string) => void;
  onEdit: (trigger: any) => void;
  onDelete: (id: string) => void;
}

export function TriggerCard({ trigger, onToggle, onEdit, onDelete }: TriggerCardProps) {
  return (
    <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <TriggerTypeBadge type={trigger.type} />
            {trigger.deliverLink && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                <LinkIcon className="w-3 h-3" /> Link
              </span>
            )}
            {trigger.followGate && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                <Shield className="w-3 h-3" /> Gated
              </span>
            )}
          </div>

          {/* Keywords */}
          {trigger.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {trigger.keywords.map((kw) => (
                <span
                  key={kw}
                  className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded text-xs font-medium"
                >
                  {kw}
                </span>
              ))}
            </div>
          )}

          {/* Reply preview */}
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {truncate(trigger.replyMessage, 80)}
          </p>

          {/* Stats */}
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
            <span>{trigger.hitCount} hits</span>
            <span>{trigger._count?.leads || 0} leads</span>
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex flex-col items-end gap-2">
          {/* Active toggle */}
          <button
            onClick={() => onToggle(trigger.id)}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              trigger.isActive
                ? "bg-green-500"
                : "bg-gray-200 dark:bg-gray-700"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                trigger.isActive ? "translate-x-5" : ""
              }`}
            />
          </button>

          {/* Actions */}
          <div className="flex items-center gap-1 mt-auto">
            <Link
              href={`/dashboard/triggers/${trigger.id}`}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <LinkIcon className="w-4 h-4" />
            </Link>
            <button
              onClick={() => onEdit(trigger)}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(trigger.id)}
              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
