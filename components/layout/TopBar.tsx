"use client";

import Image from "next/image";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, ChevronDown, Plus } from "lucide-react";
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
  const pathname = usePathname();
  const isDashboard = pathname === "/dashboard";

  const name = igAccount?.igUsername
    ? igAccount.igUsername.charAt(0).toUpperCase() + igAccount.igUsername.slice(1)
    : "Riya";

  return (
    <>
      {/* bg-[#F2F2F2] — no border, blends with page background */}
      <header className="sticky top-0 z-30 bg-[#F2F2F2] pt-6 pb-4">
        <div className="max-w-[1400px] mx-auto px-10 flex items-center justify-between gap-4">
          {/* Mobile menu */}
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg hover:bg-white/60 text-gray-600"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Left: Greeting — dashboard only */}
          {isDashboard ? (
            <div className="hidden lg:block">
              <h1 className="text-[22px] font-bold text-[#1A1A1A] leading-tight">
                {getGreeting()}, {name} 👋
              </h1>
              <p className="text-[13px] text-[#6B7280] mt-0.5 font-normal">
                Here&apos;s your account overview and performance insights.
              </p>
            </div>
          ) : (
            <div className="hidden lg:block" />
          )}

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2">
            <Image src="/icons/sidebar/zepply-logo.png" alt="Zepply" width={32} height={32} className="object-contain" />
          </div>

          {/* Right: Date pill + New Automation — dashboard only */}
          {isDashboard && (
            <div className="flex items-center gap-2.5">
              <div
                className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 bg-white rounded-full text-[13px] font-medium text-[#1A1A1A] cursor-pointer hover:bg-[#F5F5F5] transition-colors select-none"
                style={{ border: "0.5px solid #D9D9D9" }}
              >
                <Image src="/icons/dashboard/calendar.png" alt="calendar" width={13} height={13} className="object-contain" />
                Last 7 days
                <ChevronDown className="w-3 h-3 text-[#6B7280]" />
              </div>
              <button
                onClick={() => setModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#2564FF] text-white rounded-full text-[13px] font-medium hover:opacity-90 transition-all duration-150 active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                New Automation
              </button>
            </div>
          )}
        </div>
      </header>

      <NewAutomationModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
