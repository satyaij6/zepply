"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type TriggerType = "COMMENT" | "STORY_REPLY" | "DM_KEYWORD";

const TRIGGER_CARDS = [
  {
    id: "COMMENT" as TriggerType,
    name: "Comment-to-DM Reply",
    desc: "Someone comments a keyword on your post or Reel — Zepply instantly sends them a DM with your link, freebie, or offer. The highest-volume trigger for growing your audience.",
    tag: "Comment trigger",
    badge: "Most Used",
    badgeStyle: "bg-[#EEF2FF] text-[#3D7EFF]",
    iconBg: "#EEF2FF",
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M18 3H4a1.5 1.5 0 00-1.5 1.5v9A1.5 1.5 0 004 15h4l3 3.5L14 15h4a1.5 1.5 0 001.5-1.5v-9A1.5 1.5 0 0018 3z" stroke="#3D7EFF" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M14 16.5c1.5 0 3-1 3.5-2.5" stroke="#3D7EFF" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "STORY_REPLY" as TriggerType,
    name: "Story Reply Flow",
    desc: "When a follower reacts or replies to your story, Zepply turns that warm signal into a real conversation. Story repliers are your most engaged audience — capture them.",
    tag: "Story trigger",
    badge: "High Intent",
    badgeStyle: "bg-[#F3F0FF] text-[#7C3AED]",
    iconBg: "#F3F0FF",
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="11" cy="11" r="7.5" stroke="#7C3AED" strokeWidth="1.6" />
        <path d="M9 8.5l5 2.5-5 2.5V8.5z" fill="#7C3AED" />
        <path d="M7 17c1.5 1 3.5 1 5 0" stroke="#7C3AED" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "DM_KEYWORD" as TriggerType,
    name: "Keyword DM Trigger",
    desc: "When someone DMs you a specific word like 'price', 'link', or 'join' — Zepply fires an instant reply with your preset message before they lose interest or move on.",
    tag: "DM trigger",
    badge: null,
    badgeStyle: "",
    iconBg: "#ECFDF5",
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M12.5 3L7 11.5h6L10 19l9-10.5h-6L16 3h-3.5z" stroke="#059669" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    ),
  },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function NewAutomationModal({ isOpen, onClose }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<TriggerType | null>(null);
  const [query, setQuery] = useState("");
  const [animate, setAnimate] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setAnimate(true));
      const t = setTimeout(() => searchRef.current?.focus(), 280);
      return () => clearTimeout(t);
    } else {
      setAnimate(false);
      setSelected(null);
      setQuery("");
    }
  }, [isOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const handleContinue = () => {
    if (!selected) return;
    onClose();
    router.push(`/dashboard/triggers?type=${selected}`);
  };

  const q = query.toLowerCase().trim();
  const visibleCards = TRIGGER_CARDS.filter(
    (c) => !q || (c.name + " " + c.desc + " " + c.tag).toLowerCase().includes(q)
  );
  const showLockedCard =
    !q || "ai conversation mode ai trigger autopilot".includes(q);
  const showEmpty = visibleCards.length === 0 && !showLockedCard;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 transition-opacity duration-[260ms] ${
        isOpen && animate ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
      style={{ background: "rgba(15,27,76,0.52)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={`bg-white w-full sm:rounded-3xl sm:w-[780px] sm:max-w-[94vw] max-h-[92vh] sm:max-h-[88vh] overflow-y-auto p-6 sm:p-9 shadow-2xl relative transition-all duration-[260ms] rounded-t-3xl ${
          isOpen && animate ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
        }`}
        style={{ scrollbarWidth: "thin", scrollbarColor: "#3D7EFF #EEF2FF" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-[20px] font-extrabold text-[#0F1B4C]">New Automation</h2>
            <p className="text-[14px] text-[#6B7280] mt-1">Choose a trigger to start building</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#F3F4F6] flex items-center justify-center text-[#9CA3AF] hover:bg-[#E5E7EB] hover:scale-105 transition-all flex-shrink-0 ml-4"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="h-px bg-[#F3F4F6] my-5" />

        {/* Search */}
        <div className="relative mb-7">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="5" stroke="#9CA3AF" strokeWidth="1.5" />
              <path d="M11 11l3 3" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </span>
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search automation types..."
            autoComplete="off"
            className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl py-3.5 pl-11 pr-10 text-[14px] text-[#0F1B4C] placeholder:text-[#9CA3AF] outline-none focus:border-[#3D7EFF] focus:ring-2 focus:ring-[#3D7EFF]/10 transition-all"
          />
          {query && (
            <button
              onClick={() => { setQuery(""); searchRef.current?.focus(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[#E5E7EB] flex items-center justify-center text-[#6B7280] hover:bg-[#D1D5DB] transition-colors"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        {/* Section 1 — Trigger Cards */}
        {visibleCards.length > 0 && (
          <div>
            <p className="text-[11px] font-bold tracking-[1.5px] uppercase text-[#9CA3AF] mb-3.5">
              Automation Triggers
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {visibleCards.map((card) => {
                const isSelected = selected === card.id;
                return (
                  <button
                    key={card.id}
                    onClick={() => setSelected(isSelected ? null : card.id)}
                    className={`group relative text-left rounded-2xl p-[22px] cursor-pointer transition-all duration-[180ms] outline-none focus-visible:ring-2 focus-visible:ring-[#3D7EFF] ${
                      isSelected
                        ? "border-2 border-[#3D7EFF] bg-[#EEF2FF] -translate-y-0.5 shadow-[0_8px_24px_rgba(61,126,255,0.12)]"
                        : "border-[1.5px] border-[#E5E7EB] bg-white hover:border-[#3D7EFF] hover:bg-[#F8FAFF] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(61,126,255,0.1)]"
                    }`}
                  >
                    {/* Checkmark badge */}
                    <span
                      className={`absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[#3D7EFF] flex items-center justify-center transition-transform ${
                        isSelected ? "scale-100" : "scale-0"
                      }`}
                      style={{ transitionTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)", transitionDuration: "200ms" }}
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M1.5 5l2.5 2.5 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>

                    {/* Top row */}
                    <div className="flex items-start justify-between">
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: card.iconBg }}
                      >
                        {card.icon}
                      </div>
                      {card.badge && (
                        <span className={`text-[10px] font-bold tracking-[0.3px] uppercase px-2.5 py-1 rounded-full ${card.badgeStyle}`}>
                          {card.badge}
                        </span>
                      )}
                    </div>

                    {/* Content */}
                    <div className="mt-3.5">
                      <p className="text-[16px] font-bold text-[#0F1B4C] tracking-[-0.2px]">{card.name}</p>
                      <p className="text-[13px] text-[#6B7280] leading-[1.65] mt-1.5">{card.desc}</p>
                    </div>

                    {/* Bottom row */}
                    <div className="flex items-center justify-between mt-4">
                      <span className="bg-[#F3F4F6] text-[#6B7280] text-[11px] font-semibold px-2.5 py-1 rounded-md">
                        {card.tag}
                      </span>
                      <span
                        className={`text-[#3D7EFF] transition-all duration-150 ${
                          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5"
                        }`}
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M3 8h10M9 4l4 4-4 4" stroke="#3D7EFF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Section 2 — Coming Soon */}
        {showLockedCard && (
          <div className={visibleCards.length > 0 ? "mt-7" : ""}>
            <p className="text-[11px] font-bold tracking-[1.5px] uppercase text-[#9CA3AF] mb-3.5">
              Coming Soon
            </p>

            {/* Tooltip wrapper */}
            <div className="relative group/locked">
              <div className="absolute -top-11 left-1/2 -translate-x-1/2 bg-white border border-[#E5E7EB] rounded-xl px-3.5 py-2 text-[12px] text-[#374151] whitespace-nowrap shadow-md pointer-events-none opacity-0 group-hover/locked:opacity-100 transition-opacity z-10">
                AI Conversation Mode is on a separate page — launching in the next update!
                <span className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-white" />
              </div>

              {/* Locked card */}
              <div
                className="relative overflow-hidden rounded-2xl border-[1.5px] border-[#DDD8FF] px-7 py-6 pr-24"
                style={{ background: "linear-gradient(135deg, #F8F7FF 0%, #F0EEFF 100%)" }}
              >
                {/* Shimmer */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <div
                    className="absolute top-0 h-full w-[60%]"
                    style={{
                      background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)",
                      animation: "zep-shimmer 3s ease-in-out infinite",
                    }}
                  />
                </div>

                {/* Coming Soon badge */}
                <span className="absolute top-4 right-4 bg-[#7C6FFF] text-white text-[11px] font-extrabold tracking-[1px] uppercase px-3 py-1.5 rounded-full">
                  Coming Soon
                </span>

                {/* Lock icon */}
                <div className="absolute right-6 top-1/2 -translate-y-1/2 w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ background: "rgba(124,111,255,0.12)", border: "1px solid rgba(124,111,255,0.25)" }}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <rect x="4" y="8" width="10" height="8" rx="2" stroke="#7C6FFF" strokeWidth="1.5" />
                    <path d="M6 8V6a3 3 0 016 0v2" stroke="#7C6FFF" strokeWidth="1.5" strokeLinecap="round" />
                    <circle cx="9" cy="12" r="1" fill="#7C6FFF" />
                  </svg>
                </div>

                {/* Icon */}
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #EDE9FF 0%, #DDD6FF 100%)" }}
                >
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <path d="M11 3l1.2 3.6L16 8l-3.8 1.2L11 13l-1.2-3.8L6 8l3.8-1.4L11 3z" stroke="#7C6FFF" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
                    <path d="M5 14l0.7 2.1L8 17l-2.3 0.9L5 20l-0.7-2.1L2 17l2.3-0.9L5 14z" stroke="#7C6FFF" strokeWidth="1.3" strokeLinejoin="round" fill="none" />
                    <path d="M17 3l0.6 1.8L19.5 6l-1.9.8L17 9l-.6-2.2L14.5 6l1.9-.8L17 3z" stroke="#7C6FFF" strokeWidth="1.2" strokeLinejoin="round" fill="none" />
                  </svg>
                </div>

                <p className="text-[16px] font-extrabold text-[#4C3D99] tracking-[-0.3px] mt-3.5">
                  AI Conversation Mode
                </p>
                <p className="text-[13px] text-[#6B6B99] leading-[1.65] mt-1.5">
                  Once your trigger fires and a follower replies with a real question, Zepply&apos;s AI takes over — understanding their message, responding naturally in your voice, capturing leads, and closing sales. No scripts. No buttons. A real conversation on autopilot.
                </p>

                <div className="flex items-center gap-2 mt-4 flex-wrap">
                  <span className="text-[11px] font-semibold px-3 py-1.5 rounded-full" style={{ background: "rgba(124,111,255,0.1)", border: "1px solid rgba(124,111,255,0.2)", color: "#7C6FFF" }}>💬 Trigger fires</span>
                  <span className="text-[#A89FFF] text-[12px] font-semibold">→</span>
                  <span className="text-[11px] font-semibold px-3 py-1.5 rounded-full" style={{ background: "rgba(124,111,255,0.1)", border: "1px solid rgba(124,111,255,0.2)", color: "#7C6FFF" }}>DM sent</span>
                  <span className="text-[#A89FFF] text-[12px] font-semibold">→</span>
                  <span className="text-[11px] font-semibold px-3 py-1.5 rounded-full" style={{ background: "rgba(124,111,255,0.1)", border: "1px solid rgba(124,111,255,0.2)", color: "#7C6FFF" }}>🤖 AI takes over</span>
                  <span className="ml-auto text-[12px] text-[#9B8FCC]">Unlock in next update</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {showEmpty && (
          <div className="flex flex-col items-center gap-2 mt-8 text-center">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="13" cy="13" r="9" stroke="#9CA3AF" strokeWidth="1.8" />
              <path d="M20 20l5 5" stroke="#9CA3AF" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <p className="text-[15px] font-semibold text-[#6B7280]">No automations found</p>
            <p className="text-[13px] text-[#9CA3AF]">Try &apos;comment&apos; or &apos;story&apos;</p>
          </div>
        )}

        {/* Footer */}
        <div className="h-px bg-[#F3F4F6] mt-6" />
        <div className="pt-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-[13px] text-[#9CA3AF]">
            Not sure which to pick?{" "}
            <button className="text-[#3D7EFF] hover:underline">See examples →</button>
          </p>
          <div className="flex gap-2.5 w-full sm:w-auto flex-col-reverse sm:flex-row">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-white text-[#374151] border border-[#E5E7EB] rounded-full text-sm font-medium hover:bg-[#F9FAFB] transition-colors text-center"
            >
              Cancel
            </button>
            <button
              onClick={handleContinue}
              disabled={!selected}
              className={`px-7 py-2.5 rounded-full text-sm font-bold transition-all text-center ${
                selected
                  ? "bg-[#3D7EFF] text-white hover:bg-[#2563EB] cursor-pointer active:scale-[0.98]"
                  : "bg-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed"
              }`}
            >
              Continue →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
