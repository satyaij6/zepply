"use client";

import { useState } from "react";
import { Menu, Calendar, ChevronDown, Plus } from "lucide-react";
import { NewAutomationModal } from "@/components/dashboard/NewAutomationModal";

interface TopBarProps {
  onMenuClick: () => void;
  igAccount?: { igUsername: string; igProfilePic?: string | null } | null;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function TopBar({ onMenuClick, igAccount }: TopBarProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const name = igAccount?.igUsername
    ? igAccount.igUsername.charAt(0).toUpperCase() + igAccount.igUsername.slice(1)
    : "there";

  return (
    <>
      <header className="sticky top-0 z-30 bg-white border-b border-[#E5E7EB] px-7 py-4 flex items-center justify-between gap-4">
        {/* Mobile menu */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-600"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Left: Greeting */}
        <div className="hidden lg:block">
          <h1 className="text-[22px] font-bold text-[#0F1B4C]">
            {getGreeting()}, {name} 👋
          </h1>
          <p className="text-sm text-[#6B7280] mt-0.5">
            Here&apos;s what&apos;s happening with your account today.
          </p>
        </div>

        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#3D7EFF] flex items-center justify-center">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M3 8L7 12L13 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-base font-extrabold text-[#0F1B4C]">
            zep<span className="text-[#3D7EFF]">ply</span>
          </span>
        </div>

        {/* Right: Date pill + New Automation */}
        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 border border-[#E5E7EB] rounded-full text-[13px] font-medium text-[#0F1B4C] cursor-pointer hover:bg-[#F9FAFB] transition-colors select-none">
            <Calendar className="w-3.5 h-3.5 text-[#374151]" />
            Last 7 days
            <ChevronDown className="w-3 h-3 text-[#6B7280]" />
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#3D7EFF] text-white rounded-full text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" />
            New Automation
          </button>
        </div>
      </header>

      <NewAutomationModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
