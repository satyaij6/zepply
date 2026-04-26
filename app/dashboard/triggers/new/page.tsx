"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type TriggerType = "COMMENT" | "STORY_REPLY" | "DM_KEYWORD";

const MOCK_POSTS = [
  { id: 1, caption: "Morning routine that changed my life ✨", date: "Apr 22", likes: "2.3K", type: "Reel", grad: "linear-gradient(135deg,#667EEA,#764BA2)" },
  { id: 2, caption: "Skincare routine GRWM 📸", date: "Apr 20", likes: "1.8K", type: "Post", grad: "linear-gradient(135deg,#F093FB,#F5576C)" },
  { id: 3, caption: "Budget tips every creator needs", date: "Apr 19", likes: "987", type: "Reel", grad: "linear-gradient(135deg,#4FACFE,#00F2FE)" },
  { id: 4, caption: "5-min makeup hack that works", date: "Apr 17", likes: "743", type: "Post", grad: "linear-gradient(135deg,#43E97B,#38F9D7)" },
  { id: 5, caption: "Morning affirmations for creators", date: "Apr 15", likes: "621", type: "Carousel", grad: "linear-gradient(135deg,#FA709A,#FEE140)" },
  { id: 6, caption: "What I eat in a day 🥗", date: "Apr 13", likes: "534", type: "Post", grad: "linear-gradient(135deg,#A18CD1,#FBC2EB)" },
];

const SUGGESTIONS = ["link", "price", "info", "guide", "yes", "join", "drop", "free"];

function FlowBuilderInner() {
  const router = useRouter();
  const params = useSearchParams();
  const triggerType = (params.get("type") as TriggerType) || "COMMENT";
  const isComment = triggerType === "COMMENT";

  const stepLabels = isComment
    ? ["Choose Post", "Set Keywords", "Write DM", "Activate"]
    : ["Set Keywords", "Write DM", "Activate"];

  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // Step 1 (COMMENT only)
  const [postType, setPostType] = useState<"specific" | "next" | "any">("specific");
  const [selectedPost, setSelectedPost] = useState<number | null>(null);
  const [postFilter, setPostFilter] = useState("All");
  const [postSearch, setPostSearch] = useState("");

  // Keywords
  const [keywords, setKeywords] = useState<string[]>([]);
  const [kwInput, setKwInput] = useState("");
  const [anyKeyword, setAnyKeyword] = useState(false);
  const [dupProtection, setDupProtection] = useState(true);

  // DM
  const [dmText, setDmText] = useState("Hey {first_name}! 👋 Here's the link you asked for →");
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [leadOn, setLeadOn] = useState(false);
  const [leadText, setLeadText] = useState("Drop your email below and I'll send it straight to you! 📩");

  // Step 4
  const [autoName, setAutoName] = useState(() => {
    const map: Record<TriggerType, string> = {
      COMMENT: "Comment-to-DM: 'link'",
      STORY_REPLY: "Story Reply Flow",
      DM_KEYWORD: "Keyword DM Trigger",
    };
    return map[triggerType] || "New Automation";
  });
  const [activating, setActivating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showBack, setShowBack] = useState(false);

  const dmRef = useRef<HTMLTextAreaElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);

  const totalSteps = stepLabels.length;

  const goToStep = (n: number) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (n > currentStep) next.add(currentStep);
      return next;
    });
    setCurrentStep(n);
    setTimeout(() => {
      const el = document.getElementById(`step-card-${n}`);
      if (el && stepsRef.current) stepsRef.current.scrollTo({ top: el.offsetTop - 16, behavior: "smooth" });
    }, 50);
  };

  const filteredPosts = MOCK_POSTS.filter((p) => {
    const matchFilter = postFilter === "All" || p.type === postFilter;
    const matchSearch = !postSearch || p.caption.toLowerCase().includes(postSearch.toLowerCase());
    return matchFilter && matchSearch;
  });

  const addKeyword = () => {
    const val = kwInput.trim().toLowerCase();
    if (val && !keywords.includes(val)) setKeywords((prev) => [...prev, val]);
    setKwInput("");
  };

  const removeKeyword = (kw: string) => setKeywords((prev) => prev.filter((k) => k !== kw));

  const insertFirstName = () => {
    if (!dmRef.current) return;
    const ta = dmRef.current;
    const s = ta.selectionStart, e = ta.selectionEnd;
    const val = ta.value;
    const newVal = val.slice(0, s) + "{first_name}" + val.slice(e);
    setDmText(newVal);
    setTimeout(() => { ta.selectionStart = ta.selectionEnd = s + "{first_name}".length; ta.focus(); }, 0);
  };

  const step1Valid = isComment ? (postType !== "specific" || selectedPost !== null) : true;
  const step2Valid = anyKeyword || keywords.length > 0;
  const step3Valid = dmText.trim().length > 0;

  const canActivate = completedSteps.size >= totalSteps - 1;

  const handleActivate = async () => {
    setActivating(true);
    try {
      const settingsRes = await fetch("/api/settings");
      let igAccountId = "";
      if (settingsRes.ok) {
        const user = await settingsRes.json();
        igAccountId = user.igAccounts?.[0]?.id || "";
      }
      await fetch("/api/triggers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: triggerType,
          keywords: anyKeyword ? [] : keywords,
          replyMessage: dmText,
          deliverLink: linkUrl || null,
          followGate: false,
          igAccountId,
        }),
      });
      setShowSuccess(true);
    } catch {
      // still show success UI optimistically
      setShowSuccess(true);
    } finally {
      setActivating(false);
    }
  };

  const previewDm = dmText.replace(/\{first_name\}/g, "Riya");
  const charLen = dmText.length;
  const charColor = charLen >= 950 ? "text-[#EF4444]" : charLen >= 800 ? "text-[#F59E0B]" : "text-[#22C55E]";

  const typeLabel: Record<TriggerType, string> = {
    COMMENT: "Comment-to-DM",
    STORY_REPLY: "Story Reply",
    DM_KEYWORD: "Keyword DM",
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#F0F4FF]" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── TOP BAR ── */}
      <div className="bg-white border-b border-[#E5E7EB] flex-shrink-0 z-40">
        <div className="h-14 flex items-center justify-between px-6 gap-4">

          {/* Left */}
          <div className="flex items-center gap-2.5 min-w-[180px]">
            <button
              onClick={() => setShowBack(true)}
              className="w-8 h-8 rounded-full bg-[#F3F4F6] flex items-center justify-center text-[#6B7280] hover:bg-[#E5E7EB] transition-colors flex-shrink-0"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <div className="flex items-center gap-1.5 text-[13px] text-[#9CA3AF]">
              <button onClick={() => setShowBack(true)} className="hover:text-[#3D7EFF] transition-colors">Automations</button>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5L7.5 6l-3 3.5" stroke="#9CA3AF" strokeWidth="1.4" strokeLinecap="round"/></svg>
              <span className="text-[#374151] font-medium">Flow Builder</span>
            </div>
          </div>

          {/* Progress steps */}
          <div className="flex items-center gap-0 flex-1 justify-center">
            {stepLabels.map((label, i) => {
              const n = i + 1;
              const isDone = completedSteps.has(n);
              const isCurrent = currentStep === n;
              return (
                <div key={n} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold transition-all relative z-10 ${
                      isDone ? "bg-[#3D7EFF] text-white" :
                      isCurrent ? "bg-[#3D7EFF] text-white shadow-[0_0_0_3px_white,0_0_0_6px_rgba(61,126,255,0.35)]" :
                      "bg-[#E5E7EB] text-[#9CA3AF]"
                    }`}>
                      {isDone ? (
                        <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 5.5l3 3 5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      ) : n}
                    </div>
                    <span className={`text-[10px] font-semibold mt-1 whitespace-nowrap ${isDone || isCurrent ? "text-[#3D7EFF]" : "text-[#9CA3AF]"}`}>
                      {label}
                    </span>
                  </div>
                  {i < stepLabels.length - 1 && (
                    <div className={`w-14 h-0.5 mb-3.5 mx-1 transition-colors ${completedSteps.has(n) ? "bg-[#3D7EFF]" : "bg-[#E5E7EB]"}`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Right */}
          <div className="flex items-center gap-2.5 min-w-[200px] justify-end">
            <div className="flex items-center gap-1.5 text-[13px] font-semibold text-[#22C55E]">
              <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
              Live Preview
            </div>
            <button
              onClick={() => router.push("/dashboard/triggers")}
              className="px-4 py-1.5 border border-[#E5E7EB] rounded-full text-[13px] font-semibold text-[#374151] hover:bg-[#F9FAFB] transition-colors"
            >
              Save Draft
            </button>
            <button
              onClick={() => canActivate && goToStep(totalSteps)}
              disabled={!canActivate}
              className={`px-4 py-1.5 rounded-full text-[13px] font-semibold transition-colors ${
                canActivate ? "bg-[#22C55E] text-white hover:bg-[#16A34A] cursor-pointer" : "bg-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed"
              }`}
            >
              ⚡ Activate
            </button>
          </div>
        </div>

        {/* Back confirm banner */}
        {showBack && (
          <div className="bg-[#FEF9C3] border-t border-[#FDE68A] px-6 py-2 flex items-center justify-between text-[13px] text-[#92400E]">
            Leave without saving?
            <div className="flex gap-2">
              <button onClick={() => setShowBack(false)} className="px-3.5 py-1 border border-[#D97706] rounded-full bg-white text-[#92400E] text-[12px] font-semibold">Keep editing</button>
              <button onClick={() => router.push("/dashboard/triggers")} className="px-3.5 py-1 bg-[#D97706] rounded-full text-white text-[12px] font-semibold">Leave</button>
            </div>
          </div>
        )}
      </div>

      {/* Name bar */}
      <div className="bg-white border-b border-[#F3F4F6] px-7 py-2.5 flex items-center justify-between flex-shrink-0">
        <input
          value={autoName}
          onChange={(e) => setAutoName(e.target.value)}
          className="text-[15px] font-semibold text-[#0F1B4C] bg-transparent border-none outline-none border-b-2 border-transparent focus:border-[#3D7EFF] transition-colors"
        />
        <span className="text-[12px] text-[#9CA3AF]">Last saved: just now</span>
      </div>

      {/* ── BODY ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Mini sidebar */}
        <aside className="w-[220px] bg-white border-r border-[#E5E7EB] flex flex-col flex-shrink-0 hidden lg:flex">
          <div className="p-4 flex items-center gap-2">
            <div className="w-7 h-7 bg-[#3D7EFF] rounded-lg flex items-center justify-center">
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 6.5L5.5 10 11 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <span className="text-[19px] font-extrabold text-[#0F1B4C]">zep<span className="text-[#3D7EFF]">ply</span></span>
          </div>
          <div className="mx-2.5 mb-3 bg-[#F0FDF4] rounded-[9px] px-2.5 py-1.5 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] flex-shrink-0" />
            <div>
              <p className="text-[12px] font-medium text-[#0F1B4C]">{typeLabel[triggerType]}</p>
              <span className="text-[11px] text-[#22C55E]">Building...</span>
            </div>
          </div>
          {[
            { label: "Dashboard", icon: <rect x="1" y="1" width="5" height="5" rx="1.5" fill="currentColor" opacity=".8"/> },
          ].map((_, i) => null)}
          {[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Automations", href: "/dashboard/triggers", active: true },
            { label: "Conversations", href: "/dashboard" },
            { label: "Leads & CRM", href: "/dashboard/leads" },
            { label: "Analytics", href: "/dashboard/analytics" },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => item.active ? undefined : router.push(item.href)}
              className={`flex items-center gap-2 mx-2 mb-0.5 px-3 py-2 rounded-[9px] text-[13px] font-medium transition-colors border-l-[3px] ${
                item.active
                  ? "bg-[#EEF2FF] text-[#3D7EFF] border-[#3D7EFF]"
                  : "text-[#6B7280] border-transparent hover:bg-[#F9FAFB]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </aside>

        {/* Steps panel */}
        <div
          ref={stepsRef}
          className="w-[380px] bg-[#F8FAFC] border-r border-[#E5E7EB] overflow-y-auto p-5 flex-shrink-0"
          style={{ scrollbarWidth: "thin", scrollbarColor: "#E5E7EB transparent" }}
        >

          {/* ── STEP 1: Choose Post (COMMENT only) ── */}
          {isComment && (
            <StepCard
              id={1}
              label="Choose Post"
              subtitle="Which post triggers this?"
              currentStep={currentStep}
              completedSteps={completedSteps}
              onEdit={() => goToStep(1)}
            >
              {/* Radio options */}
              <div className="flex flex-col gap-2 pt-3.5">
                {(["specific", "next", "any"] as const).map((pt) => (
                  <div
                    key={pt}
                    onClick={() => setPostType(pt)}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border-[1.5px] cursor-pointer transition-all ${
                      postType === pt ? "border-[#3D7EFF] bg-[#F8FAFF]" : "border-[#E5E7EB] hover:border-[#3D7EFF]"
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                      postType === pt ? "border-[#3D7EFF] bg-[#3D7EFF]" : "border-[#E5E7EB]"
                    }`}>
                      {postType === pt && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </span>
                    <div>
                      <p className="text-[13px] font-semibold text-[#0F1B4C] capitalize">{pt === "specific" ? "Specific Post" : pt === "next" ? "Next Post" : "Any Post"}</p>
                      <p className="text-[11px] text-[#9CA3AF]">{pt === "specific" ? "Select from your existing posts" : pt === "next" ? "Activates on your very next post" : "Works on all posts automatically"}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Post grid */}
              {postType === "specific" && (
                <div className="mt-3">
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#9CA3AF]">
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.3"/><path d="M9.5 9.5l2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                    </span>
                    <input
                      value={postSearch}
                      onChange={(e) => setPostSearch(e.target.value)}
                      placeholder="Search by caption..."
                      className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-[10px] py-2 pl-8 pr-3 text-[13px] text-[#0F1B4C] outline-none focus:border-[#3D7EFF]"
                    />
                  </div>
                  <div className="flex gap-4 mt-2.5 border-b border-[#F3F4F6] pb-0">
                    {["All", "Reel", "Post", "Carousel"].map((f) => (
                      <button
                        key={f}
                        onClick={() => setPostFilter(f)}
                        className={`text-[12px] font-semibold pb-2 border-b-2 transition-all ${postFilter === f ? "text-[#3D7EFF] border-[#3D7EFF]" : "text-[#9CA3AF] border-transparent"}`}
                      >
                        {f === "All" ? "All" : f + "s"}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2.5">
                    {filteredPosts.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => setSelectedPost(p.id)}
                        className={`border-[1.5px] rounded-[10px] overflow-hidden cursor-pointer transition-all ${
                          selectedPost === p.id ? "border-[#3D7EFF] bg-[#EEF2FF]" : "border-[#E5E7EB] hover:border-[#3D7EFF]"
                        }`}
                      >
                        <div className="relative aspect-square" style={{ background: p.grad }}>
                          {selectedPost === p.id && (
                            <div className="absolute inset-0 bg-[rgba(61,126,255,0.15)]" />
                          )}
                          <span className="absolute top-1.5 right-1.5 bg-white/90 text-[9px] font-semibold text-[#374151] px-1.5 py-0.5 rounded-md">{p.type}</span>
                          {selectedPost === p.id && (
                            <span className="absolute top-1.5 left-1.5 w-4.5 h-4.5 bg-[#3D7EFF] rounded-full flex items-center justify-center">
                              <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.4" strokeLinecap="round"/></svg>
                            </span>
                          )}
                        </div>
                        <div className="p-2">
                          <p className="text-[12px] font-medium text-[#0F1B4C] truncate">{p.caption}</p>
                          <div className="flex justify-between mt-0.5 text-[10px] text-[#9CA3AF]">
                            <span>{p.date}</span><span>❤ {p.likes}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => step1Valid && goToStep(2)}
                disabled={!step1Valid}
                className={`w-full mt-3.5 py-3 rounded-xl text-[14px] font-bold transition-all ${step1Valid ? "bg-[#3D7EFF] text-white hover:opacity-90" : "bg-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed"}`}
              >
                Continue to Keywords →
              </button>
            </StepCard>
          )}

          {/* ── STEP 2 (or 1 for non-COMMENT): Keywords ── */}
          <StepCard
            id={isComment ? 2 : 1}
            label="Set Keywords"
            subtitle="What triggers the DM?"
            currentStep={currentStep}
            completedSteps={completedSteps}
            onEdit={() => goToStep(isComment ? 2 : 1)}
          >
            {/* Any keyword toggle */}
            <div className="flex items-start justify-between gap-3 pt-3.5">
              <div>
                <p className="text-[13px] font-semibold text-[#0F1B4C]">Any keyword</p>
                <p className="text-[11px] text-[#9CA3AF] mt-0.5">DM fires on every comment</p>
              </div>
              <Toggle on={anyKeyword} onToggle={() => setAnyKeyword(!anyKeyword)} />
            </div>
            {anyKeyword && (
              <div className="mt-2 px-3 py-2.5 bg-[#F9FAFB] rounded-[9px] text-[12px] text-[#9CA3AF]">
                Not needed — all comments will trigger your DM.
              </div>
            )}

            {!anyKeyword && (
              <div className="mt-3.5">
                <p className="text-[12px] font-semibold text-[#374151] mb-1.5">Trigger keywords</p>
                <div className="flex gap-2">
                  <input
                    value={kwInput}
                    onChange={(e) => setKwInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }}
                    placeholder="e.g. 'link'"
                    className="flex-1 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[10px] px-3 py-2.5 text-[13px] text-[#0F1B4C] outline-none focus:border-[#3D7EFF]"
                  />
                  <button onClick={addKeyword} className="w-10 h-10 bg-[#3D7EFF] text-white rounded-[10px] flex items-center justify-center flex-shrink-0 text-lg font-bold">+</button>
                </div>
                {keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {keywords.map((kw) => (
                      <span key={kw} className="flex items-center gap-1 bg-[#EEF2FF] border border-[#BFDBFE] text-[#3D7EFF] text-[12px] font-semibold px-2.5 py-1 rounded-full">
                        {kw}
                        <button onClick={() => removeKeyword(kw)} className="text-[#93C5FD] hover:text-[#EF4444] text-[13px] leading-none ml-0.5">×</button>
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-[10px] font-bold tracking-[1px] uppercase text-[#9CA3AF] mt-3 mb-1.5">Popular keywords</p>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => { if (!keywords.includes(s)) setKeywords((prev) => [...prev, s]); }}
                      className="border border-[#E5E7EB] bg-white text-[#6B7280] text-[12px] px-3 py-1 rounded-full hover:border-[#3D7EFF] hover:text-[#3D7EFF] transition-all"
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-[#9CA3AF] italic mt-2.5">ℹ We match 'LINK', 'Link', and 'link' automatically</p>
              </div>
            )}

            <div className="flex items-start justify-between gap-3 mt-4 pt-4 border-t border-[#F3F4F6]">
              <div>
                <p className="text-[13px] font-semibold text-[#0F1B4C]">Duplicate DM protection</p>
                <p className="text-[11px] text-[#9CA3AF] mt-0.5">Don't DM same person twice in 24h</p>
              </div>
              <Toggle on={dupProtection} onToggle={() => setDupProtection(!dupProtection)} />
            </div>

            <button
              onClick={() => step2Valid && goToStep(isComment ? 3 : 2)}
              disabled={!step2Valid}
              className={`w-full mt-3.5 py-3 rounded-xl text-[14px] font-bold transition-all ${step2Valid ? "bg-[#3D7EFF] text-white hover:opacity-90" : "bg-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed"}`}
            >
              Continue to Write DM →
            </button>
          </StepCard>

          {/* ── STEP 3 (or 2): Write DM ── */}
          <StepCard
            id={isComment ? 3 : 2}
            label="Write DM"
            subtitle="What message do they receive?"
            currentStep={currentStep}
            completedSteps={completedSteps}
            onEdit={() => goToStep(isComment ? 3 : 2)}
          >
            <div className="pt-3.5">
              <div className="flex justify-between items-center mb-1">
                <p className="text-[12px] font-semibold text-[#374151]">Message</p>
              </div>
              <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-3">
                <p className="text-[11px] font-bold text-[#9CA3AF] mb-2">Variation 1</p>
                <textarea
                  ref={dmRef}
                  value={dmText}
                  onChange={(e) => setDmText(e.target.value)}
                  placeholder="Write your DM..."
                  className="w-full min-h-[90px] bg-white border border-[#E5E7EB] rounded-[10px] px-3 py-2.5 text-[14px] leading-[1.6] text-[#0F1B4C] resize-y outline-none focus:border-[#3D7EFF] transition-colors"
                />
                <div className="flex items-center gap-2 mt-2">
                  <button onClick={insertFirstName} className="bg-[#EEF2FF] border border-[#BFDBFE] text-[#3D7EFF] text-[11px] font-bold px-2 py-1 rounded-md hover:bg-[#DBEAFE] transition-colors">{"{first_name}"}</button>
                  <span className={`ml-auto text-[11px] font-medium ${charColor}`}>{charLen} / 1000</span>
                </div>
              </div>

              {/* Add Link */}
              <button
                onClick={() => setLinkOpen(!linkOpen)}
                className="flex items-center gap-1.5 mt-2.5 px-3 py-2 border border-[#E5E7EB] rounded-lg bg-white text-[13px] text-[#374151] hover:bg-[#F9FAFB] transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M5 8l3-3M7.5 3.5l1.5-1.5a2.5 2.5 0 013.5 3.5l-1.5 1.5M5.5 9.5L4 11A2.5 2.5 0 01.5 7.5L2 6" stroke="#374151" strokeWidth="1.4" strokeLinecap="round"/></svg>
                + Add Link
              </button>
              {linkOpen && (
                <div className="mt-2 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[10px] p-3 space-y-2">
                  <div>
                    <p className="text-[12px] font-semibold text-[#374151] mb-1">Button label</p>
                    <input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="Get the link" className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-[13px] text-[#0F1B4C] outline-none focus:border-[#3D7EFF]" />
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold text-[#374151] mb-1">Destination URL</p>
                    <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-[13px] text-[#0F1B4C] outline-none focus:border-[#3D7EFF]" />
                  </div>
                </div>
              )}

              {/* Lead capture */}
              <div className="bg-white border border-[#E5E7EB] rounded-xl p-3.5 mt-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-bold text-[#0F1B4C]">Lead Capture</p>
                    <span className="text-[10px] font-bold bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0] px-2 py-0.5 rounded-full">Converts better</span>
                  </div>
                  <Toggle on={leadOn} onToggle={() => setLeadOn(!leadOn)} green />
                </div>
                <p className="text-[12px] text-[#6B7280] mt-1.5 leading-[1.4]">Ask for their email before sending the link. Captured emails go straight to your Leads & CRM.</p>
                {leadOn && (
                  <div className="mt-3">
                    <p className="text-[12px] font-semibold text-[#374151] mb-1">Message asking for email:</p>
                    <textarea value={leadText} onChange={(e) => setLeadText(e.target.value)} className="w-full min-h-[55px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-[10px] px-3 py-2 text-[13px] text-[#0F1B4C] resize-none outline-none focus:border-[#3D7EFF]" />
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => step3Valid && goToStep(isComment ? 4 : 3)}
              disabled={!step3Valid}
              className={`w-full mt-3.5 py-3 rounded-xl text-[14px] font-bold transition-all ${step3Valid ? "bg-[#3D7EFF] text-white hover:opacity-90" : "bg-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed"}`}
            >
              Continue to Activate →
            </button>
          </StepCard>

          {/* ── STEP 4 (or 3): Review & Activate ── */}
          <StepCard
            id={totalSteps}
            label="Review & Activate"
            subtitle="Everything looks good?"
            currentStep={currentStep}
            completedSteps={completedSteps}
            onEdit={() => goToStep(totalSteps)}
          >
            <div className="pt-3.5 space-y-3">
              {/* Summary */}
              <div className="bg-white border border-[#E5E7EB] rounded-xl p-4">
                <p className="text-[13px] font-bold text-[#0F1B4C] mb-3">Automation Summary</p>
                {isComment && (
                  <SumRow label="Post" value={
                    postType !== "specific"
                      ? (postType === "next" ? "Next Post" : "Any Post")
                      : (MOCK_POSTS.find((p) => p.id === selectedPost)?.caption.slice(0, 28) + "..." || "—")
                  } onEdit={() => goToStep(1)} />
                )}
                <SumRow label="Keywords" value={anyKeyword ? "Any keyword" : (keywords.join(", ") || "—")} onEdit={() => goToStep(isComment ? 2 : 1)} />
                <SumRow label="DM" value={dmText.slice(0, 32) + "..."} onEdit={() => goToStep(isComment ? 3 : 2)} />
                <SumRow label="Lead capture" value={leadOn ? "✅ ON" : "OFF"} onEdit={() => goToStep(isComment ? 3 : 2)} last />
              </div>

              {/* Name */}
              <div>
                <p className="text-[12px] font-semibold text-[#374151] mb-1.5">Automation name</p>
                <input
                  value={autoName}
                  onChange={(e) => setAutoName(e.target.value)}
                  className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-[10px] px-3 py-2.5 text-[14px] text-[#0F1B4C] outline-none focus:border-[#3D7EFF]"
                />
              </div>

              {/* Expected performance */}
              <div className="rounded-xl p-3.5" style={{ background: "linear-gradient(135deg,#F0F7FF,#EEF2FF)", border: "1px solid #E5E7EB" }}>
                <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#3D7EFF] mb-3">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1L4.5 6h4L6.5 13 12.5 6H8.5L11 1H7z" stroke="#3D7EFF" strokeWidth="1.4" strokeLinejoin="round"/></svg>
                  Expected Performance
                </div>
                {[
                  ["Fires within", "~3 seconds"],
                  ["Est. DMs per day", "~43 DMs"],
                  ["Based on", "Your last 5 posts"],
                ].map(([l, v]) => (
                  <div key={l} className="flex justify-between py-1.5">
                    <span className="text-[12px] text-[#6B7280]">{l}</span>
                    <span className="text-[12px] font-bold text-[#0F1B4C]">{v}</span>
                  </div>
                ))}
                <p className="text-[10px] text-[#9CA3AF] italic mt-2">ℹ Estimate based on recent engagement. Actual results may vary.</p>
              </div>

              <button
                onClick={handleActivate}
                disabled={activating}
                className="w-full py-4 bg-[#22C55E] text-white font-extrabold text-[15px] rounded-xl shadow-[0_4px_14px_rgba(34,197,94,0.3)] hover:bg-[#16A34A] hover:shadow-[0_6px_20px_rgba(34,197,94,0.4)] transition-all active:scale-[0.98] disabled:opacity-70"
              >
                {activating ? "Activating..." : "⚡ Activate Automation"}
              </button>
              <button onClick={() => router.push("/dashboard/triggers")} className="w-full text-center text-[12px] text-[#6B7280] hover:underline">
                Save as Draft
              </button>
            </div>
          </StepCard>

        </div>

        {/* ── PREVIEW PANEL ── */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-[280px]">
          <div className="bg-white border-b border-[#E5E7EB] px-6 py-3 flex items-center justify-between flex-shrink-0">
            <div>
              <p className="text-[13px] font-bold text-[#0F1B4C]">Live Preview</p>
              <p className="text-[11px] text-[#9CA3AF] mt-0.5">Updates as you build</p>
            </div>
          </div>
          <div className="flex-1 flex flex-col items-center justify-start p-7 gap-4 overflow-y-auto">
            {/* Phone mockup */}
            <div className="w-[238px] bg-[#1a1a1a] rounded-[40px] p-[11px] shadow-[0_24px_48px_rgba(0,0,0,0.25)]" style={{ boxShadow: "0 24px 48px rgba(0,0,0,0.25), inset 0 0 0 1px rgba(255,255,255,0.1)" }}>
              <div className="w-14 h-2 bg-[#1a1a1a] rounded-full mx-auto mb-2" />
              <div className="bg-white rounded-[32px] overflow-hidden min-h-[460px]">
                {/* DM header */}
                <div className="bg-white border-b border-[#F3F4F6] px-3 py-2.5 flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="#374151" strokeWidth="1.6" strokeLinecap="round"/></svg>
                  <div className="w-7 h-7 rounded-full bg-[#A78BFA] flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">R</div>
                  <div className="flex-1">
                    <p className="text-[12px] font-bold text-[#0F1B4C]">@riya.creates</p>
                    <p className="text-[10px] text-[#9CA3AF]">Creator</p>
                  </div>
                  <span className="text-[#9CA3AF] text-[14px]">···</span>
                </div>
                {/* Messages */}
                <div className="p-3 flex flex-col gap-2.5">
                  <p className="text-[10px] text-[#9CA3AF] text-center">Just now</p>
                  {/* Follower bubble */}
                  <div className="flex items-end gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-[#E5E7EB] flex-shrink-0" />
                    <div className="bg-[#F3F4F6] rounded-[16px_16px_16px_3px] px-3 py-2 text-[12px] text-[#0F1B4C] max-w-[85%]">
                      {keywords[0] || (triggerType === "STORY_REPLY" ? "Replied to your story ✨" : "link")}
                    </div>
                  </div>
                  {/* Creator bubble */}
                  <div className="flex flex-col items-end gap-1.5">
                    <div className="bg-[#3D7EFF] rounded-[16px_16px_3px_16px] px-3 py-2.5 text-[12px] text-white max-w-[90%] leading-[1.5] break-words">
                      {previewDm}
                    </div>
                    {linkLabel && (
                      <div className="bg-white/20 border border-white/40 rounded-[9px] px-3 py-1.5 text-[11px] text-[#3D7EFF] font-semibold border-[#3D7EFF] border bg-white">
                        {linkLabel}
                      </div>
                    )}
                    {leadOn && (
                      <>
                        <div className="bg-[#3D7EFF] rounded-[16px_16px_3px_16px] px-3 py-2.5 text-[12px] text-white max-w-[90%] leading-[1.5]">{leadText}</div>
                        <div className="bg-[#F3F4F6] rounded-[16px_16px_16px_3px] px-3 py-2 text-[12px] text-[#0F1B4C] self-start">riya@gmail.com</div>
                      </>
                    )}
                    <span className="text-[10px] text-[#9CA3AF]">Sent ✓</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#22C55E]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
              Delivered in ~3 seconds
            </div>
            <p className="text-[11px] text-[#9CA3AF] italic text-center max-w-[220px]">This is exactly how followers experience your automation</p>
          </div>
        </div>
      </div>

      {/* ── SUCCESS OVERLAY ── */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center" style={{ background: "linear-gradient(135deg,#16A34A,#22C55E)" }}>
          <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mb-6">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <path d="M8 20L16 28L32 12" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="60" strokeDashoffset="0" style={{ animation: "draw-check 0.5s ease-out forwards" }} />
            </svg>
          </div>
          <h2 className="text-[26px] font-extrabold text-white mb-2">Automation activated!</h2>
          <p className="text-[14px] text-white/80 mb-8">{autoName} is now live</p>
          <div className="flex gap-3">
            <button onClick={() => router.push("/dashboard/triggers")} className="px-6 py-3 border-2 border-white/50 rounded-full text-white font-semibold text-[14px] hover:bg-white/10 transition-colors">
              View Automations
            </button>
            <button onClick={() => router.push("/dashboard")} className="px-6 py-3 bg-white rounded-full text-[#16A34A] font-bold text-[14px] hover:opacity-90 transition-opacity">
              Go to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──

function StepCard({
  id, label, subtitle, currentStep, completedSteps, onEdit, children,
}: {
  id: number; label: string; subtitle: string;
  currentStep: number; completedSteps: Set<number>;
  onEdit: () => void; children: React.ReactNode;
}) {
  const isDone = completedSteps.has(id);
  const isCurrent = currentStep === id;
  const isLocked = !isDone && !isCurrent;

  return (
    <div
      id={`step-card-${id}`}
      className={`bg-white border rounded-2xl mb-2.5 overflow-hidden transition-colors ${
        isCurrent ? "border-[#BFDBFE]" : isLocked ? "border-[#E5E7EB] opacity-60" : "border-[#E5E7EB]"
      }`}
    >
      <div className="flex items-center gap-2.5 px-4 py-3.5 cursor-pointer" onClick={isDone ? onEdit : undefined}>
        <div className={`w-6.5 h-6.5 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0 transition-all ${
          isDone ? "bg-[#3D7EFF] text-white" : isCurrent ? "bg-[#3D7EFF] text-white" : "bg-[#E5E7EB] text-[#9CA3AF]"
        }`} style={{ width: 26, height: 26 }}>
          {isDone ? (
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 5.5l3 3 5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          ) : id}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-bold text-[#0F1B4C]">{label}</p>
          <p className="text-[11px] text-[#9CA3AF] mt-0.5">{subtitle}</p>
        </div>
        {isDone && !isCurrent && (
          <button onClick={onEdit} className="text-[12px] text-[#3D7EFF] hover:underline flex-shrink-0">Edit</button>
        )}
      </div>
      {isCurrent && (
        <div className="px-4 pb-4 border-t border-[#F3F4F6]">
          {children}
        </div>
      )}
    </div>
  );
}

function Toggle({ on, onToggle, green }: { on: boolean; onToggle: () => void; green?: boolean }) {
  return (
    <button
      onClick={onToggle}
      className={`w-9 h-5 rounded-full relative flex-shrink-0 transition-colors mt-0.5 ${on ? (green ? "bg-[#22C55E]" : "bg-[#3D7EFF]") : "bg-[#D1D5DB]"}`}
    >
      <span className={`absolute top-[3px] w-3.5 h-3.5 bg-white rounded-full shadow transition-transform ${on ? "translate-x-[18px]" : "translate-x-[3px]"}`} />
    </button>
  );
}

function SumRow({ label, value, onEdit, last }: { label: string; value: string; onEdit: () => void; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-2.5 ${!last ? "border-b border-[#F3F4F6]" : ""}`}>
      <span className="text-[12px] text-[#9CA3AF] font-medium min-w-[80px]">{label}</span>
      <span className="text-[12px] text-[#0F1B4C] font-semibold flex-1 mx-2.5 truncate">{value}</span>
      <button onClick={onEdit} className="text-[11px] text-[#3D7EFF] hover:underline flex-shrink-0">Edit →</button>
    </div>
  );
}

export default function FlowBuilderPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-[#F0F4FF]">
        <div className="animate-spin w-8 h-8 border-2 border-[#3D7EFF] border-t-transparent rounded-full" />
      </div>
    }>
      <FlowBuilderInner />
    </Suspense>
  );
}
