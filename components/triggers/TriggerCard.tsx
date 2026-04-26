"use client";

import { truncate } from "@/lib/utils";
import { TriggerTypeBadge } from "./TriggerTypeSelector";
import { Link as LinkIcon, Shield, Pencil, Trash2, ExternalLink } from "lucide-react";
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
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-5 transition-all hover:shadow-[0_4px_16px_rgba(61,126,255,0.08)] hover:border-[#BFDBFE]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2.5 flex-wrap">
            <TriggerTypeBadge type={trigger.type} />
            {trigger.deliverLink && (
              <span className="inline-flex items-center gap-1 text-[11px] text-[#6B7280] bg-[#F3F4F6] px-2 py-0.5 rounded-full">
                <LinkIcon className="w-3 h-3" /> Link
              </span>
            )}
            {trigger.followGate && (
              <span className="inline-flex items-center gap-1 text-[11px] text-[#F59E0B] bg-[#FEF9C3] px-2 py-0.5 rounded-full">
                <Shield className="w-3 h-3" /> Gated
              </span>
            )}
          </div>

          {/* Keywords */}
          {trigger.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {trigger.keywords.map((kw) => (
                <span
                  key={kw}
                  className="px-2.5 py-0.5 bg-[#EEF2FF] border border-[#BFDBFE] text-[#3D7EFF] rounded-full text-[12px] font-semibold"
                >
                  {kw}
                </span>
              ))}
            </div>
          )}

          {/* Reply preview */}
          <p className="text-[13px] text-[#374151] leading-[1.5] mt-1">
            {truncate(trigger.replyMessage, 100)}
          </p>

          {/* Stats */}
          <div className="flex items-center gap-4 mt-3 text-[12px] text-[#9CA3AF]">
            <span className="font-medium">{trigger.hitCount} hits</span>
            <span>•</span>
            <span className="font-medium">{trigger._count?.leads || 0} leads</span>
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {/* Active toggle */}
          <button
            onClick={() => onToggle(trigger.id)}
            className={`relative w-10 h-5 rounded-full transition-colors ${
              trigger.isActive ? "bg-[#22C55E]" : "bg-[#D1D5DB]"
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                trigger.isActive ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>

          {/* Actions */}
          <div className="flex items-center gap-0.5 mt-auto">
            <Link
              href={`/dashboard/triggers/${trigger.id}`}
              className="p-1.5 rounded-lg hover:bg-[#F3F4F6] text-[#9CA3AF] hover:text-[#3D7EFF] transition-colors"
              title="View details"
            >
              <ExternalLink className="w-4 h-4" />
            </Link>
            <button
              onClick={() => onEdit(trigger)}
              className="p-1.5 rounded-lg hover:bg-[#F3F4F6] text-[#9CA3AF] hover:text-[#3D7EFF] transition-colors"
              title="Edit"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(trigger.id)}
              className="p-1.5 rounded-lg hover:bg-[#FEE2E2] text-[#9CA3AF] hover:text-[#EF4444] transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
