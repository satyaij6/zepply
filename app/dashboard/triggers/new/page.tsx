"use client";

import { useState, useRef, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type TriggerType = "COMMENT" | "STORY_REPLY" | "DM_KEYWORD";

const GRADS = [
  "linear-gradient(135deg,#667EEA,#764BA2)",
  "linear-gradient(135deg,#F093FB,#F5576C)",
  "linear-gradient(135deg,#4FACFE,#00F2FE)",
  "linear-gradient(135deg,#43E97B,#38F9D7)",
  "linear-gradient(135deg,#FA709A,#FEE140)",
  "linear-gradient(135deg,#A18CD1,#FBC2EB)",
];

type IGPost = {
  id: string | number;
  caption: string;
  date: string;
  likes: string;
  type: "Reel" | "Post" | "Carousel";
  grad: string;
  thumbnailUrl?: string | null;
};

const MOCK_POSTS: IGPost[] = [
  { id: 1, caption: "Morning routine that changed my life ✨", date: "Apr 22", likes: "2.3K", type: "Reel", grad: GRADS[0] },
  { id: 2, caption: "Skincare routine GRWM 📸", date: "Apr 20", likes: "1.8K", type: "Post", grad: GRADS[1] },
  { id: 3, caption: "Budget tips every creator needs", date: "Apr 19", likes: "987", type: "Reel", grad: GRADS[2] },
  { id: 4, caption: "5-min makeup hack that works", date: "Apr 17", likes: "743", type: "Post", grad: GRADS[3] },
  { id: 5, caption: "Morning affirmations for creators", date: "Apr 15", likes: "621", type: "Carousel", grad: GRADS[4] },
  { id: 6, caption: "What I eat in a day 🥗", date: "Apr 13", likes: "534", type: "Post", grad: GRADS[5] },
];

const SUGGESTIONS = ["link", "price", "info", "guide", "yes", "join", "drop", "free"];

const DEFAULT_PUBLIC_REPLIES = [
  "Got you 👀 check your DMs",
  "Just sent you a message",
  "DM'd you the details",
  "Sent it your way! 🚀",
  "Check your requests! 📬",
  "Just slid into your DMs",
  "Sent! Let me know if you got it",
  "Link is in your inbox 💌",
  "Gotcha! Check your messages",
  "Sent the info! 📤",
  "Just DM'd you! 📥",
  "You've got mail! 📩",
  "Check your hidden requests just in case 👀",
  "Sent it! Hope you like it 🫶",
  "Delivered to your DMs! ✨"
];

function FlowBuilderInner() {
  const router = useRouter();
  const params = useSearchParams();
  const triggerType = (params.get("type") as TriggerType) || "COMMENT";
  const isComment = triggerType === "COMMENT";
  const isStoryReply = triggerType === "STORY_REPLY";
  const hasMediaStep = isComment || isStoryReply;

  const stepLabels = hasMediaStep
    ? [isStoryReply ? "Choose Story" : "Choose Post", "Set Keywords", "Write DM", "Advanced", "Activate"]
    : ["Set Keywords", "Write DM", "Advanced", "Activate"];

  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // Step 1 (COMMENT only)
  const [postType, setPostType] = useState<"specific" | "next" | "any">("specific");
  const [selectedPost, setSelectedPost] = useState<string | number | null>(null);
  const [postFilter, setPostFilter] = useState("All");
  const [postSearch, setPostSearch] = useState("");
  const [showPostsModal, setShowPostsModal] = useState(false);
  const [realPosts, setRealPosts] = useState<IGPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);

  // Keywords
  const [keywords, setKeywords] = useState<string[]>([]);
  const [kwInput, setKwInput] = useState("");
  const [anyKeyword, setAnyKeyword] = useState(false);
  const [dupProtection, setDupProtection] = useState(true);

  // DM
  const [dmText, setDmText] = useState("Hey {first_name}! 👋 Here's the link you asked for →");
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkUrlError, setLinkUrlError] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [leadOn, setLeadOn] = useState(false);
  const [leadText, setLeadText] = useState("Drop your email below and I'll send it straight to you! 📩");
  const [openingDmOn, setOpeningDmOn] = useState(false);
  const [openingDmText, setOpeningDmText] = useState("");
  const [openingDmBtnLabel, setOpeningDmBtnLabel] = useState("");

  // Advanced
  const [publicReplyOn, setPublicReplyOn] = useState(false);
  const [publicReplies, setPublicReplies] = useState<string[]>([]);
  const [askFollowOn, setAskFollowOn] = useState(false);
  const [askFollowText, setAskFollowText] = useState("Looks like you're not following yet 👀\nFollow me and tap 'I'm following' — I'll send it right away 🙌");
  const [followUpOn, setFollowUpOn] = useState(false);
  const [followUpText, setFollowUpText] = useState("Hey 👀 just wanted to make sure you saw this, it's worth checking out");
  const [followUpHours, setFollowUpHours] = useState(0);
  const [followUpMinutes, setFollowUpMinutes] = useState(30);

  const [showReplyModal, setShowReplyModal] = useState(false);
  const [replyModalMode, setReplyModalMode] = useState<"add" | "edit">("add");
  const [replyModalIndex, setReplyModalIndex] = useState<number | null>(null);
  const [replyModalText, setReplyModalText] = useState("");
  const [lastAdvancedPreview, setLastAdvancedPreview] = useState<"COMMENTS" | "CHAT">("COMMENTS");

  // Step 4 (Activate)
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
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [keywords, anyKeyword, dmText, openingDmText, openingDmOn, leadText, leadOn, askFollowText, askFollowOn, followUpText, followUpOn, currentStep]);

  useEffect(() => {
    if (!hasMediaStep) return;
    setPostsLoading(true);
    fetch("/api/instagram/media")
      .then((r) => r.json())
      .then((json) => {
        if (json.data?.length) {
          const mapped: IGPost[] = json.data.map((p: any, i: number) => ({
            id: p.id,
            caption: p.caption || "Untitled post",
            date: new Date(p.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            likes: "—",
            type: p.mediaType === "VIDEO" ? "Reel" : p.mediaType === "CAROUSEL_ALBUM" ? "Carousel" : "Post",
            grad: GRADS[i % GRADS.length],
            thumbnailUrl: p.thumbnailUrl || null,
          }));
          setRealPosts(mapped);
        }
      })
      .catch(() => { /* fall back to MOCK_POSTS */ })
      .finally(() => setPostsLoading(false));
  }, [hasMediaStep]);

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

  const allPosts = realPosts.length > 0 ? realPosts : MOCK_POSTS;
  const filteredPosts = allPosts.filter((p) => {
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

  const step1Valid = hasMediaStep ? (postType !== "specific" || selectedPost !== null) : true;
  const step2Valid = anyKeyword || keywords.length > 0;
  const isLinkValid = () => {
    const hasLabel = linkLabel.trim().length > 0;
    const hasUrl = linkUrl.trim().length > 0;
    if (!hasLabel && !hasUrl) return true;
    if (!hasLabel || !hasUrl) return false;
    try {
      const u = new URL(linkUrl.trim());
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  };
  const step3Valid = dmText.trim().length > 0 && isLinkValid();
  const dmStep = hasMediaStep ? 3 : 2;
  const userHasReachedDmStep = currentStep >= dmStep || completedSteps.has(dmStep);
  const showDmBubble = userHasReachedDmStep && dmText.trim().length > 0;

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
          igAccountId,
          name: autoName,
          type: triggerType,
          keywords: anyKeyword ? [] : keywords,
          replyMessage: dmText,
          deliverLink: linkUrl || null,
          followGate: askFollowOn,
          publicReplyOn,
          publicReplies: publicReplyOn ? publicReplies : [],
          postScope: hasMediaStep ? postType : undefined,
          selectedPostId: hasMediaStep && postType === "specific" ? String(selectedPost ?? "") : null,
          openingDmText: openingDmOn ? openingDmText : null,
          openingDmBtnLabel: openingDmOn ? openingDmBtnLabel : null,
          followUpOn,
          followUpText: followUpOn ? followUpText : null,
          followUpDelayMins: followUpOn ? followUpHours * 60 + followUpMinutes : null,
        }),
      });
      setShowSuccess(true);
    } catch {
      setShowSuccess(true);
    } finally {
      setActivating(false);
    }
  };

  const previewDm = dmText.replace(/\{first_name\}/g, "Riya");
  const charLen = dmText.length;
  const charColor = charLen >= 950 ? "text-[#EF4444]" : charLen >= 800 ? "text-[#F59E0B]" : "text-[#22C55E]";


  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#F2F2F2]" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── TOP BAR ── */}
      <div className="bg-white border-b border-[#E5E7EB] flex-shrink-0 z-40">
        <div className="h-14 flex items-center justify-between px-6 gap-4">

          {/* Left */}
          <div className="flex items-center gap-2.5 min-w-[180px]">
            <button
              onClick={() => setShowBack(true)}
              className="w-8 h-8 rounded-full bg-[#F3F4F6] flex items-center justify-center text-[#6B7280] hover:bg-[#E5E7EB] transition-colors flex-shrink-0"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <div className="flex items-center gap-1.5 text-[13px] text-[#9CA3AF]">
              <button onClick={() => setShowBack(true)} className="hover:text-[#3D7EFF] transition-colors">Automations</button>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5L7.5 6l-3 3.5" stroke="#9CA3AF" strokeWidth="1.4" strokeLinecap="round" /></svg>
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
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold transition-all relative z-10 ${isDone ? "bg-[#3D7EFF] text-white" :
                      isCurrent ? "bg-[#3D7EFF] text-white shadow-[0_0_0_3px_white,0_0_0_6px_rgba(61,126,255,0.35)]" :
                        "bg-[#E5E7EB] text-[#9CA3AF]"
                      }`}>
                      {isDone ? (
                        <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1.5 5.5l3 3 5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
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
              onClick={() => {
                if (!canActivate || activating) return;
                if (currentStep === totalSteps) {
                  handleActivate();
                } else {
                  goToStep(totalSteps);
                }
              }}
              disabled={!canActivate || activating}
              className={`px-4 py-1.5 rounded-full text-[13px] font-semibold transition-colors ${activating ? "bg-[#86efac] text-white cursor-not-allowed" :
                canActivate ? "bg-[#22C55E] text-white hover:bg-[#16A34A] cursor-pointer" : "bg-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed"
                }`}
            >
              {activating ? "⚡ Activating..." : "⚡ Activate"}
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
        <div className="flex items-center gap-2 group">
          <input
            id="auto-name-input"
            value={autoName}
            onChange={(e) => setAutoName(e.target.value)}
            onFocus={(e) => e.target.select()}
            onBlur={() => {
              if (!autoName.trim()) {
                const defaults: Record<TriggerType, string> = {
                  COMMENT: "Comment-to-DM: 'link'",
                  STORY_REPLY: "Story Reply Flow",
                  DM_KEYWORD: "Keyword DM Trigger",
                };
                setAutoName(defaults[triggerType] || "New Automation");
              }
            }}
            className="text-[15px] font-semibold text-[#0F1B4C] bg-transparent border-none outline-none border-b-2 border-transparent focus:border-[#3D7EFF] transition-colors"
          />
          <svg
            width="14" height="14" viewBox="0 0 14 14" fill="none"
            className="text-[#9CA3AF] group-hover:text-[#3D7EFF] transition-colors flex-shrink-0 cursor-text"
            onClick={() => document.getElementById("auto-name-input")?.focus()}
          >
            <path d="M9.5 1.5a1.414 1.414 0 0 1 2 2L4 11l-3 1 1-3 7.5-7.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span className="text-[12px] text-[#9CA3AF]">Last saved: just now</span>
      </div>

      {/* ── BODY ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Steps panel */}
        <div
          ref={stepsRef}
          className="w-[430px] bg-[#F8FAFC] border-r border-[#E5E7EB] overflow-y-auto p-5 flex-shrink-0"
          style={{ scrollbarWidth: "thin", scrollbarColor: "#E5E7EB transparent", scrollbarGutter: "stable", fontFamily: "'Roboto', sans-serif" }}
        >

          {/* ── STEP 1: Choose Post or Story (COMMENT & STORY_REPLY) ── */}
          {hasMediaStep && (
            <StepCard
              id={1}
              label={isStoryReply ? "Choose a Story" : "Choose a Post"}
              subtitle={isStoryReply ? "Which story triggers this?" : "Which post triggers this?"}
              currentStep={currentStep}
              completedSteps={completedSteps}
              onEdit={() => goToStep(1)}
            >
              <div className="flex flex-col gap-3 pt-4">
                {([
                  { key: "specific", title: `Specific ${isStoryReply ? "story" : "post"}`, sub: `choose from existing ${isStoryReply ? "stories" : "posts"}` },
                  { key: "next", title: `Next ${isStoryReply ? "Story" : "Post"}`, sub: `Activates on your very next ${isStoryReply ? "story" : "post"}` },
                  { key: "any", title: `Any ${isStoryReply ? "Story" : "Post"}`, sub: `works on all ${isStoryReply ? "stories" : "posts"} automatically` },
                ] as const).map(({ key, title, sub }) => (
                  <div
                    key={key}
                    onClick={() => setPostType(key)}
                    className="flex items-center gap-3.5 px-5 py-2 cursor-pointer transition-all"
                    style={{
                      border: `1.5px solid ${postType === key ? '#2564FF' : '#D9D9D9'}`,
                      background: '#FFFFFF',
                      borderRadius: 18,
                    }}
                  >
                    {/* Radio dot */}
                    <div
                      className="flex-shrink-0 flex items-center justify-center"
                      style={{
                        width: 20, height: 20, borderRadius: '50%',
                        border: '2.5px solid #727272',
                        background: '#FFFFFF',
                        flexShrink: 0,
                      }}
                    >
                      {postType === key && (
                        <div style={{ width: 13, height: 13, borderRadius: '50%', background: '#2564FF' }} />
                      )}
                    </div>
                    <div>
                      <p className="text-[14px] font-bold leading-tight capitalize" style={{ color: '#000000' }}>{title}</p>
                      <p className="text-[13px] mt-0.5" style={{ color: '#727272' }}>{sub}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Media selector grid */}
              {postType === "specific" && (
                <div className="mt-4">
                  {/* Tab bar (hide filter tabs for stories) */}
                  {!isStoryReply && (
                    <div className="flex gap-5 pb-0" style={{ borderBottom: '1.5px solid #D9D9D9' }}>
                      {["All", "Reels", "Posts", "Carousels"].map((label) => {
                        const filterVal = label === "All" ? "All" : label === "Reels" ? "Reel" : label === "Posts" ? "Post" : "Carousel";
                        const active = postFilter === filterVal;
                        return (
                          <button
                            key={label}
                            onClick={() => setPostFilter(filterVal)}
                            className="pb-2.5 text-[13px] font-semibold border-b-2 -mb-px transition-all"
                            style={{ borderColor: active ? '#000000' : 'transparent', color: active ? '#000000' : '#8A8A8A' }}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* 3-column portrait grid */}
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    {postsLoading ? (
                      [0,1,2].map((i) => (
                        <div key={i} className="rounded-xl overflow-hidden" style={{ aspectRatio: '3/4', background: '#E5E7EB', animation: 'pulse 1.5s ease-in-out infinite' }} />
                      ))
                    ) : filteredPosts.slice(0, 3).map((p) => (
                      <div
                        key={p.id}
                        onClick={() => setSelectedPost(p.id)}
                        className="cursor-pointer rounded-xl overflow-hidden transition-all"
                        style={{ border: `2px solid ${selectedPost === p.id ? '#2564FF' : '#D9D9D9'}` }}
                      >
                        {p.thumbnailUrl ? (
                          <img src={p.thumbnailUrl} alt={p.caption} style={{ aspectRatio: '3/4', width: '100%', objectFit: 'cover', display: 'block' }} />
                        ) : (
                          <div style={{ aspectRatio: '3/4', background: p.grad }} />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Load More */}
                  <button
                    onClick={() => setShowPostsModal(true)}
                    className="w-full mt-3 py-3 rounded-xl text-[13px] font-semibold hover:opacity-80 transition-opacity"
                    style={{ background: '#F3F3F3', color: '#606060', border: '1.5px dashed #AAAAAA' }}
                  >
                    Load More
                  </button>
                </div>
              )}

              {/* Next button */}
              <button
                onClick={() => step1Valid && goToStep(2)}
                disabled={!step1Valid}
                className="w-full mt-4 py-2.5 rounded-xl text-[14px] font-bold transition-all"
                style={{
                  background: step1Valid ? '#2564FF' : '#D9D9D9',
                  color: step1Valid ? '#FFFFFF' : '#9F9F9F',
                  cursor: step1Valid ? 'pointer' : 'not-allowed',
                }}
              >
                Next
              </button>
            </StepCard>
          )}

          {/* ── STEP 2 (or 1 for non-COMMENT): Keywords ── */}
          <StepCard
            id={hasMediaStep ? 2 : 1}
            label="Set Keywords"
            subtitle="What triggers the DM?"
            currentStep={currentStep}
            completedSteps={completedSteps}
            onEdit={() => goToStep(hasMediaStep ? 2 : 1)}
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
              onClick={() => step2Valid && goToStep(hasMediaStep ? 3 : 2)}
              disabled={!step2Valid}
              className={`w-full mt-3.5 py-3 rounded-xl text-[14px] font-bold transition-all ${step2Valid ? "bg-[#3D7EFF] text-white hover:opacity-90" : "bg-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed"}`}
            >
              Continue to Write DM →
            </button>
          </StepCard>

          {/* ── STEP 3 (or 2): Write DM ── */}
          <StepCard
            id={hasMediaStep ? 3 : 2}
            label="Write DM"
            subtitle="What message do they receive?"
            currentStep={currentStep}
            completedSteps={completedSteps}
            onEdit={() => goToStep(hasMediaStep ? 3 : 2)}
          >
            <div className="pt-3.5">

              {/* Opening DM toggle */}
              <div className="bg-white border border-[#E5E7EB] rounded-xl p-3.5 mb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 10V3a1 1 0 011-1h8a1 1 0 011 1v5a1 1 0 01-1 1H5L2 10z" stroke="#3D7EFF" strokeWidth="1.4" strokeLinejoin="round" /></svg>
                    <p className="text-[13px] font-bold text-[#0F1B4C]">Opening DM</p>
                    <span className="text-[10px] font-bold bg-[#EEF2FF] text-[#3D7EFF] border border-[#BFDBFE] px-2 py-0.5 rounded-full">Optional</span>
                  </div>
                  <Toggle on={openingDmOn} onToggle={() => setOpeningDmOn(!openingDmOn)} />
                </div>
                <p className="text-[12px] text-[#6B7280] mt-1.5 leading-[1.4]">Send an initial message before the main DM — great for a warm intro or teaser.</p>
                {openingDmOn && (
                  <div className="mt-3 space-y-2">
                    <textarea
                      value={openingDmText}
                      onChange={(e) => setOpeningDmText(e.target.value)}
                      placeholder="e.g. Hey! I saw your comment 👀 Sending you something special..."
                      className="w-full min-h-[72px] bg-[#F9FAFB] border border-[#E5E7EB] rounded-[10px] px-3 py-2.5 text-[13px] leading-[1.6] text-[#0F1B4C] resize-none outline-none focus:border-[#3D7EFF] transition-colors"
                    />
                    <div>
                      <p className="text-[12px] font-semibold text-[#374151] mb-1">Button label <span className="text-[#9CA3AF] font-normal">(click to send main DM)</span></p>
                      <input
                        value={openingDmBtnLabel}
                        onChange={(e) => setOpeningDmBtnLabel(e.target.value)}
                        placeholder="e.g. Get Access, Send me the link"
                        className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-3 py-2 text-[13px] text-[#0F1B4C] outline-none focus:border-[#3D7EFF] transition-colors"
                      />
                      <p className="text-[11px] text-[#9CA3AF] mt-1">When the follower taps this, the main DM is sent automatically.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Lead capture */}
              <div className="bg-white border border-[#E5E7EB] rounded-xl p-3.5 mb-3">
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

              <div className="flex justify-between items-center mb-1">
                <p className="text-[12px] font-semibold text-[#374151]">Message {leadOn && <span className="text-[#9CA3AF] font-normal">(sent after they provide email)</span>}</p>
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
              {/* Add Link */}
              {linkLabel && !linkOpen && (
                /* ── Link added — show preview chip ── */
                <div className="mt-2.5 flex items-center gap-2 bg-[#EEF2FF] border border-[#BFDBFE] rounded-[10px] px-3 py-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#3D7EFF] flex items-center justify-center flex-shrink-0">
                    <svg width="12" height="12" viewBox="0 0 13 13" fill="none"><path d="M5 8l3-3M7.5 3.5l1.5-1.5a2.5 2.5 0 013.5 3.5l-1.5 1.5M5.5 9.5L4 11A2.5 2.5 0 01.5 7.5L2 6" stroke="white" strokeWidth="1.5" strokeLinecap="round" /></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold text-[#0F1B4C] truncate">{linkLabel}</p>
                    {linkUrl && <p className="text-[10px] text-[#6B7280] truncate">{linkUrl}</p>}
                  </div>
                  <button
                    onClick={() => setLinkOpen(!linkOpen)}
                    title="Edit"
                    className="w-6 h-6 rounded-md flex items-center justify-center text-[#3D7EFF] hover:bg-[#DBEAFE] transition-colors flex-shrink-0"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8 1.5a1.2 1.2 0 011.7 1.7L3.5 9.4l-2 .6.6-2L8 1.5z" stroke="#3D7EFF" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                  <button
                    onClick={() => { setLinkLabel(""); setLinkUrl(""); setLinkOpen(false); setLinkUrlError(""); }}
                    title="Remove"
                    className="w-6 h-6 rounded-md flex items-center justify-center text-[#EF4444] hover:bg-[#FEE2E2] transition-colors flex-shrink-0"
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 2l6 6M8 2L2 8" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" /></svg>
                  </button>
                </div>
              )}

              {!linkLabel && !linkOpen && (
                <button
                  onClick={() => setLinkOpen(true)}
                  className="flex items-center gap-1.5 mt-2.5 px-3 py-2 border border-[#E5E7EB] rounded-lg bg-white text-[13px] text-[#374151] hover:bg-[#F9FAFB] transition-colors"
                >
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M5 8l3-3M7.5 3.5l1.5-1.5a2.5 2.5 0 013.5 3.5l-1.5 1.5M5.5 9.5L4 11A2.5 2.5 0 01.5 7.5L2 6" stroke="#374151" strokeWidth="1.4" strokeLinecap="round" /></svg>
                  + Add Link
                </button>
              )}
              {linkOpen && (
                <div className="mt-2 bg-[#F9FAFB] border border-[#E5E7EB] rounded-[10px] p-3 space-y-2">
                  <div>
                    <p className="text-[12px] font-semibold text-[#374151] mb-1">Button label</p>
                    <input value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="Get the link" className="w-full bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-[13px] text-[#0F1B4C] outline-none focus:border-[#3D7EFF]" />
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold text-[#374151] mb-1">Destination URL</p>
                    <input
                      value={linkUrl}
                      onChange={(e) => {
                        setLinkUrl(e.target.value);
                        if (linkUrlError) setLinkUrlError("");
                      }}
                      onBlur={() => {
                        if (!linkUrl.trim()) { setLinkUrlError(""); return; }
                        try {
                          const u = new URL(linkUrl.trim());
                          if (u.protocol !== "http:" && u.protocol !== "https:") {
                            setLinkUrlError("URL must start with http:// or https://");
                          } else {
                            setLinkUrlError("");
                          }
                        } catch {
                          setLinkUrlError("Please enter a valid URL (e.g. https://example.com)");
                        }
                      }}
                      placeholder="https://..."
                      className={`w-full bg-white border rounded-lg px-3 py-2 text-[13px] text-[#0F1B4C] outline-none transition-colors ${linkUrlError ? "border-[#EF4444] focus:border-[#EF4444]" : "border-[#E5E7EB] focus:border-[#3D7EFF]"}`}
                    />
                    {linkUrlError && (
                      <p className="text-[11px] text-[#EF4444] mt-1 flex items-center gap-1">
                        <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><circle cx="5.5" cy="5.5" r="5" stroke="#EF4444" strokeWidth="1" /><path d="M5.5 3v3" stroke="#EF4444" strokeWidth="1.2" strokeLinecap="round" /><circle cx="5.5" cy="8" r="0.6" fill="#EF4444" /></svg>
                        {linkUrlError}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => {
                        if (!isLinkValid() || !linkLabel.trim()) {
                          setLinkLabel("");
                          setLinkUrl("");
                          setLinkUrlError("");
                        }
                        setLinkOpen(false);
                      }}
                      className="flex-1 py-2 bg-[#E5E7EB] text-[#374151] text-[13px] font-bold rounded-lg hover:bg-[#D1D5DB] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (!linkLabel.trim()) {
                          setLinkOpen(false);
                          return;
                        }
                        // Validate URL before saving
                        if (linkUrl.trim()) {
                          try {
                            const u = new URL(linkUrl.trim());
                            if (u.protocol !== "http:" && u.protocol !== "https:") {
                              setLinkUrlError("URL must start with http:// or https://");
                              return;
                            }
                            setLinkUrlError("");
                          } catch {
                            setLinkUrlError("Please enter a valid URL (e.g. https://example.com)");
                            return;
                          }
                        }
                        setLinkOpen(false);
                      }}
                      disabled={!isLinkValid()}
                      className={`flex-1 py-2 text-[13px] font-bold rounded-lg transition-opacity ${isLinkValid() ? "bg-[#3D7EFF] text-white hover:opacity-90" : "bg-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed"}`}
                    >
                      ✓ Done
                    </button>
                  </div>
                </div>
              )}

            </div>

            <button
              onClick={() => step3Valid && goToStep(hasMediaStep ? 4 : 3)}
              disabled={!step3Valid}
              className={`w-full mt-3.5 py-3 rounded-xl text-[14px] font-bold transition-all ${step3Valid ? "bg-[#3D7EFF] text-white hover:opacity-90" : "bg-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed"}`}
            >
              Continue to Advanced →
            </button>
          </StepCard>

          {/* ── Advanced Automations Step ── */}
          <StepCard
            id={hasMediaStep ? 4 : 3}
            label="Advanced Automation"
            subtitle=""
            currentStep={currentStep}
            completedSteps={completedSteps}
            onEdit={() => goToStep(hasMediaStep ? 4 : 3)}
          >
            <div className="pt-2 space-y-2.5">
              {[
                {
                  id: 'publicReply', label: 'Publicly reply to comments', state: publicReplyOn, setter: (val: boolean) => {
                    setPublicReplyOn(val);
                    if (val) {
                      const shuffled = [...DEFAULT_PUBLIC_REPLIES].sort(() => 0.5 - Math.random());
                      setPublicReplies(shuffled.slice(0, 3));
                    }
                  }
                },
                { id: 'askFollow', label: 'Ask to follow before sending DM', state: askFollowOn, setter: setAskFollowOn },
                { id: 'followUp', label: 'Send follow-up message', state: followUpOn, setter: setFollowUpOn },
              ].filter(item => item.id !== 'publicReply' || isComment).map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col border border-[#D9D9D9] rounded-[16px] bg-white overflow-hidden"
                  onClick={() => setLastAdvancedPreview(item.id === 'publicReply' ? 'COMMENTS' : 'CHAT')}
                >
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      {/* Blue chat icon */}
                      <div className="flex-shrink-0 flex items-center justify-center">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                          <rect x="1" y="2.5" width="14" height="10" rx="3" fill="#2564FF" />
                          <path d="M4 12.5v3l3-3H4z" fill="#2564FF" />
                          <circle cx="5" cy="7.5" r="1.2" fill="white" />
                          <circle cx="8" cy="7.5" r="1.2" fill="white" />
                          <circle cx="11" cy="7.5" r="1.2" fill="white" />
                        </svg>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-[14px] font-semibold text-[#000000] whitespace-nowrap">{item.label}</p>
                        <div className="text-[#8A8A8A] flex-shrink-0 cursor-help" title="More info">
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                            <circle cx="8" cy="8" r="7" stroke="#9F9F9F" strokeWidth="1.2" />
                            <path d="M8 5v1.5M8 8.5v3" stroke="#9F9F9F" strokeWidth="1.2" strokeLinecap="round" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    <Toggle on={item.state} onToggle={() => item.setter(!item.state)} />
                  </div>

                  {/* Expanded Content (Configured for publicReply) */}
                  {item.id === 'publicReply' && (
                    <div className={`grid transition-all duration-300 ease-in-out ${item.state ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                      <div className="overflow-hidden">
                        <div className="px-4 pb-4 pt-1 space-y-3">
                          {publicReplies.map((reply, idx) => (
                            <div key={idx} className="relative group">
                              <div
                                className="w-full border border-[#8A8A8A] rounded-[14px] px-4 py-3 pr-16 text-[14px] text-[#000000] bg-white truncate text-left"
                              >
                                {reply}
                              </div>
                              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => {
                                    setReplyModalMode("edit");
                                    setReplyModalIndex(idx);
                                    setReplyModalText(reply);
                                    setShowReplyModal(true);
                                  }}
                                  className="text-[#8A8A8A] hover:text-[#000000] transition-colors"
                                  title="Edit reply"
                                >
                                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                  </svg>
                                </button>
                                {publicReplies.length > 1 && (
                                  <button
                                    onClick={() => setPublicReplies(publicReplies.filter((_, i) => i !== idx))}
                                    className="text-[#FF0000] hover:text-[#DC2626] transition-colors"
                                    title="Delete reply"
                                  >
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="3 6 5 6 21 6"></polyline>
                                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                      <line x1="10" y1="11" x2="10" y2="17"></line>
                                      <line x1="14" y1="11" x2="14" y2="17"></line>
                                    </svg>
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                          <button
                            onClick={() => {
                              setReplyModalMode("add");
                              setReplyModalIndex(null);
                              setReplyModalText("");
                              setShowReplyModal(true);
                            }}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-semibold hover:opacity-90 transition-opacity"
                            style={{ background: '#F3F3F3', color: '#606060', border: '1.5px dashed #AAAAAA' }}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="3" width="18" height="18" rx="4" ry="4"></rect>
                              <line x1="12" y1="8" x2="12" y2="16"></line>
                              <line x1="8" y1="12" x2="16" y2="12"></line>
                            </svg>
                            Add Public Reply
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Expanded Content (Configured for askFollow) */}
                  {item.id === 'askFollow' && (
                    <div className={`grid transition-all duration-300 ease-in-out ${item.state ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                      <div className="overflow-hidden">
                        <div className="px-4 pb-4 pt-2 flex flex-col gap-2">
                          <p className="text-[14px] font-bold text-[#000000]">Follow Request Message</p>
                          <textarea
                            value={askFollowText}
                            onChange={(e) => setAskFollowText(e.target.value)}
                            className="w-full border border-[#8A8A8A] rounded-[14px] px-4 py-3 text-[14px] text-[#000000] outline-none focus:border-[#2564FF] transition-colors resize-none min-h-[85px]"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Expanded Content (Configured for followUp) */}
                  {item.id === 'followUp' && (
                    <div className={`grid transition-all duration-300 ease-in-out ${item.state ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                      <div className="overflow-hidden">
                        <div className="px-4 pb-4 pt-1 flex flex-col gap-3.5">
                          <textarea
                            value={followUpText}
                            onChange={(e) => setFollowUpText(e.target.value)}
                            className="w-full border border-[#8A8A8A] rounded-[14px] px-4 py-3 text-[15px] text-[#000000] outline-none focus:border-[#2564FF] transition-colors resize-none min-h-[90px]"
                          />
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-[15px] text-[#000000]">
                            <span>Send follow-up message after:</span>
                            <div className="flex items-center gap-1.5 ml-1 whitespace-nowrap">
                              <input
                                type="number"
                                min="0"
                                max="23"
                                value={followUpHours}
                                onChange={(e) => {
                                  let val = Number(e.target.value);
                                  if (val > 23) val = 23;
                                  if (val < 0) val = 0;
                                  setFollowUpHours(val);
                                }}
                                className="w-[42px] h-[32px] bg-[#E5E7EB] border border-[#D1D5DB] rounded-md text-center text-[15px] outline-none focus:border-[#2564FF] transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <span>h :</span>
                              <input
                                type="number"
                                min="0"
                                max="59"
                                value={followUpMinutes}
                                onChange={(e) => {
                                  let val = Number(e.target.value);
                                  if (val > 59) val = 59;
                                  if (val < 0) val = 0;
                                  setFollowUpMinutes(val);
                                }}
                                className="w-[42px] h-[32px] bg-[#E5E7EB] border border-[#D1D5DB] rounded-md text-center text-[15px] outline-none focus:border-[#2564FF] transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <span>m</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}


                </div>
              ))}

              <button
                onClick={() => goToStep(totalSteps)}
                className="w-full mt-4 py-3.5 rounded-xl text-[15px] font-bold bg-[#2564FF] text-white hover:opacity-90 transition-all"
              >
                Continue to Activate →
              </button>
            </div>
          </StepCard>

          {/* ── Activate Step ── */}
          <StepCard
            id={totalSteps}
            label="Review & Activate"
            subtitle="Everything looks good?"
            currentStep={currentStep}
            completedSteps={completedSteps}
            onEdit={() => goToStep(totalSteps)}
          >
            <div className="pt-3.5 space-y-5">
              {/* Name */}
              <div>
                <p className="text-[13px] font-bold text-[#0F1B4C] mb-2">Automation name</p>
                <input
                  value={autoName}
                  onChange={(e) => setAutoName(e.target.value)}
                  className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-[10px] px-4 py-3 text-[14px] text-[#0F1B4C] outline-none focus:border-[#3D7EFF] transition-colors"
                />
              </div>

              {/* Summary */}
              <div className="bg-white border border-[#E5E7EB] rounded-[12px] p-4">
                <p className="text-[13px] font-bold text-[#0F1B4C] mb-4">Automation Summary</p>
                {hasMediaStep && (
                  <SumRow label={isStoryReply ? "Story" : "Post"} value={
                    postType !== "specific"
                      ? (postType === "next" ? `Next ${isStoryReply ? "Story" : "Post"}` : `Any ${isStoryReply ? "Story" : "Post"}`)
                      : (allPosts.find((p) => p.id === selectedPost)?.caption.slice(0, 28) + "..." || "—")
                  } onEdit={() => goToStep(1)} />
                )}
                <SumRow label="Keywords" value={anyKeyword ? "Any keyword" : (keywords.join(", ") || "—")} onEdit={() => goToStep(hasMediaStep ? 2 : 1)} />
                <SumRow label="DM" value={dmText.slice(0, 32) + "..."} onEdit={() => goToStep(hasMediaStep ? 3 : 2)} />
                <SumRow label="Lead capture" value={leadOn ? "✅ ON" : "OFF"} onEdit={() => goToStep(hasMediaStep ? 3 : 2)} last />
              </div>

              <div className="pt-2 flex flex-col gap-3">
                <button
                  onClick={handleActivate}
                  disabled={activating}
                  className="w-full py-4 bg-[#22C55E] text-white font-extrabold text-[15px] rounded-xl shadow-[0_4px_14px_rgba(34,197,94,0.3)] hover:bg-[#16A34A] hover:shadow-[0_6px_20px_rgba(34,197,94,0.4)] transition-all active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1L4.5 6h4L6.5 13 12.5 6H8.5L11 1H7z" fill="white" /></svg>
                  {activating ? "Activating..." : "Activate Automation"}
                </button>
                <button onClick={() => router.push("/dashboard/triggers")} className="w-full text-center text-[13px] font-medium text-[#6B7280] hover:text-[#374151] transition-colors">
                  Save as Draft
                </button>
              </div>
            </div>
          </StepCard>

        </div>

        {/* ── PREVIEW PANEL ── */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-[280px]">
          <div className="bg-[#F2F2F2] border-b border-[#F2F2F2] px-6 py-3 flex items-center justify-between flex-shrink-0">

          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-7 gap-4 overflow-hidden">
            {/* Phone mockup — iphone-Frame.png shell */}
            <div className="relative flex-shrink-0" style={{ width: 300 }}>
              {/* Invisible frame img sets container height from PNG aspect ratio */}
              <img src="/zepply chat ui icons/iphone-Frame.png" alt="" className="w-full block" style={{ visibility: 'hidden' }} />

              {/* Screen content — fills the inner screen area of the frame */}
              <div className="absolute bg-[#000000] overflow-hidden"
                style={{ top: '1.5%', left: '3.5%', right: '3.5%', bottom: '1.5%', borderRadius: 44, zIndex: 1 }}>

                <div
                  className="flex h-full w-[200%] transition-transform duration-500 ease-in-out"
                  style={{ transform: `translateX(-${((hasMediaStep && currentStep === 1) || (isComment && currentStep === 4 && publicReplyOn && lastAdvancedPreview === 'COMMENTS')) ? 0 : 50}%)` }}
                >

                  {/* SLIDE 1: POST FEED VIEW */}
                  <div className="w-1/2 h-full flex flex-col bg-[#000000] text-white relative overflow-hidden">
                    {isStoryReply ? (
                      // ── STORY UI ──
                      <div className="absolute inset-0 w-full h-full flex flex-col" style={{
                        background: (() => { const p = allPosts.find(x => x.id === selectedPost); return p?.thumbnailUrl ? `url(${p.thumbnailUrl}) center/cover no-repeat` : (p?.grad || 'linear-gradient(135deg, #1E1F23, #2C2D32)'); })()
                      }}>
                        {/* Safe area spacer */}
                        <div className="h-10 w-full" />

                        {/* Progress bar */}
                        <div className="px-3 flex gap-1 mb-2">
                          <div className="h-[2px] bg-white rounded-full w-full opacity-80" />
                        </div>

                        {/* Story Header */}
                        <div className="flex items-center justify-between px-3">
                          <div className="flex items-center gap-2.5">
                            <img src="/zepply chat ui icons/demo profile image.png" className="w-[30px] h-[30px] rounded-full object-cover border border-white/20" alt="" />
                            <div className="flex items-center gap-1.5">
                              <span className="text-[13px] font-semibold text-white drop-shadow-md">Riyacreations</span>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="#3D7EFF"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.4-1.4 3.6 3.6 7.6-7.6L19 8l-9 9z" fill="white" /></svg>
                              <span className="text-[13px] text-white/80 drop-shadow-md">8h</span>
                            </div>
                          </div>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 13a1 1 0 100-2 1 1 0 000 2zM12 6a1 1 0 100-2 1 1 0 000 2zM12 20a1 1 0 100-2 1 1 0 000 2z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0px 1px 2px rgba(0,0,0,0.5))" }} /></svg>
                        </div>

                        <div className="flex-1" /> {/* spacer for story content */}

                        {/* Story Footer / Input */}
                        <div className="px-3 pb-6 pt-8 flex items-center gap-4 bg-gradient-to-t from-black/60 to-transparent">
                          <div className="flex-1 h-11 rounded-[22px] border border-white/40 bg-black/20 backdrop-blur-sm flex items-center px-4">
                            <span className="text-white text-[13px]">Send message</span>
                          </div>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" stroke="white" strokeWidth="2" style={{ filter: "drop-shadow(0px 1px 2px rgba(0,0,0,0.5))" }} /></svg>
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0px 1px 2px rgba(0,0,0,0.5))" }} /></svg>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Post Header */}
                        <div className="flex items-center gap-4 px-4 pt-10 pb-3 border-b border-[#2C2D32] flex-shrink-0">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          <p className="text-[16px] font-bold">Posts</p>
                        </div>

                        <div className="flex-1 overflow-y-auto pb-4" style={{ scrollbarWidth: 'none' }}>
                          {/* User Header */}
                          <div className="flex items-center justify-between px-3 py-3">
                            <div className="flex items-center gap-2">
                              <img src="/zepply chat ui icons/demo profile image.png" className="w-8 h-8 rounded-full object-cover" alt="" />
                              <p className="text-[13px] font-bold">Riyacreations</p>
                            </div>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 13a1 1 0 100-2 1 1 0 000 2zM12 6a1 1 0 100-2 1 1 0 000 2zM12 20a1 1 0 100-2 1 1 0 000 2z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          </div>

                          {/* Post Image */}
                          {(() => {
                            const post = allPosts.find(p => p.id === selectedPost);
                            return post?.thumbnailUrl ? (
                              <img src={post.thumbnailUrl} alt={post.caption} className="w-full" style={{ aspectRatio: '4/5', objectFit: 'cover', display: 'block' }} />
                            ) : (
                              <div className="w-full" style={{ aspectRatio: '4/5', background: post?.grad || 'linear-gradient(135deg, #1E1F23, #2C2D32)' }} />
                            );
                          })()}

                          {/* Action Bar */}
                          <div className="px-3 py-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-4">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" stroke="white" strokeWidth="2" /></svg>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                              </div>
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            </div>
                            <p className="text-[13px] font-bold mb-1">{allPosts.find(p => p.id === selectedPost)?.likes || "1.2K"} likes</p>
                            <p className="text-[13px]">
                              <span className="font-bold mr-1">Riyacreations</span>
                              {allPosts.find(p => p.id === selectedPost)?.caption || "Amazing new post!"}
                            </p>
                          </div>
                        </div>
                      </>
                    )}

                    {/* COMMENTS OVERLAY (SLIDES UP) */}
                    <div
                      className={`absolute inset-0 bg-black/60 transition-opacity duration-500 ease-in-out z-10 ${isComment && currentStep === 4 && publicReplyOn && lastAdvancedPreview === 'COMMENTS' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                    />
                    <div
                      className="absolute bottom-0 left-0 right-0 h-[75%] bg-[#121212] rounded-t-3xl flex flex-col border-t border-[#2C2D32] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] transition-transform duration-500 ease-in-out z-20"
                      style={{ transform: (isComment && currentStep === 4 && publicReplyOn && lastAdvancedPreview === 'COMMENTS') ? 'translateY(0)' : 'translateY(100%)' }}
                    >
                      <div className="flex justify-center pt-3 pb-2">
                        <div className="w-10 h-[4px] bg-[#444] rounded-full" />
                      </div>
                      <div className="flex items-center justify-between px-4 pb-3 border-b border-[#2C2D32]">
                        <div className="w-6" /> {/* spacer */}
                        <p className="text-[13px] font-bold text-white">Comments</p>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 13a1 1 0 100-2 1 1 0 000 2zM12 6a1 1 0 100-2 1 1 0 000 2zM12 20a1 1 0 100-2 1 1 0 000 2z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </div>
                      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5" style={{ scrollbarWidth: 'none' }}>
                        {/* Parent Comment */}
                        <div className="flex gap-3">
                          <img src="/zepply chat ui icons/demo profile image.png" className="w-8 h-8 rounded-full object-cover flex-shrink-0" alt="" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <p className="text-[12px] text-[#A3A3A3]"><span className="font-bold text-white mr-1.5">Riyacreations</span>3s</p>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78v0z" stroke="#A3A3A3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                            </div>
                            <p className="text-[13px] text-white mt-0.5 leading-[1.4]">{anyKeyword ? "Hey! I'm interested" : (keywords[0] || "link")}</p>
                            <div className="flex items-center gap-4 mt-2 text-[11px] text-[#A3A3A3] font-semibold">
                              <span>Reply</span>
                              <span>Hide</span>
                            </div>

                            {/* Author Reply */}
                            <div className="flex gap-3 mt-4">
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0" style={{ background: "linear-gradient(135deg,#833AB4,#FD1D1D,#FCB045)" }}>Z</div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <p className="text-[12px] text-[#A3A3A3]"><span className="font-bold text-white mr-1.5">Author</span>Just now</p>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78v0z" stroke="#A3A3A3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                </div>
                                <p className="text-[13px] text-white mt-0.5 leading-[1.4]">{publicReplies[0] || "Got you 👀 check your DMs"}</p>
                                <div className="flex items-center gap-4 mt-2 text-[11px] text-[#A3A3A3] font-semibold">
                                  <span>Reply</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      {/* Input Bar */}
                      <div className="px-4 py-3 border-t border-[#2C2D32] flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0" style={{ background: "linear-gradient(135deg,#833AB4,#FD1D1D,#FCB045)" }}>Z</div>
                        <div className="flex-1 bg-[#2C2D32] rounded-full px-4 py-2.5 flex items-center justify-between">
                          <span className="text-[13px] text-[#A3A3A3]">Add a comment...</span>
                          <span className="text-[12px] font-bold text-[#A3A3A3]">GIF</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SLIDE 2: CHAT VIEW */}
                  <div className="w-1/2 h-full flex flex-col bg-[#000000]">
                    {/* Header */}
                    <div className="flex items-center gap-2 px-3.5 pt-7 pb-3 bg-[#000000] flex-shrink-0">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                        <path d="M10 2.5L4 8l6 5.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <img src="/zepply chat ui icons/demo profile image.png" alt="" className="w-8 h-8 rounded-full flex-shrink-0 object-cover" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-bold text-white truncate leading-none">Riyacre...</p>
                        <p className="text-[10px] text-[#777777] leading-none mt-1">riyacre...</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">

                        <img src="/zepply chat ui icons/telephone.png" alt="" className="w-[15px] h-[15px] object-contain" />
                        <img src="/zepply chat ui icons/video.png" alt="" className="w-[15px] h-[15px] object-contain" />
                        <img src="/zepply chat ui icons/label.png" alt="" className="w-[15px] h-[15px] object-contain" />
                      </div>
                    </div>

                    {/* Messages */}
                    <div ref={chatContainerRef} className="flex-1 px-3.5 pt-2.5 pb-2 flex flex-col gap-3 bg-[#000000] overflow-y-auto scroll-smooth" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>

                      {/* Empty state — shown when nothing is configured yet */}
                      {!anyKeyword && keywords.length === 0 && !showDmBubble && (
                        <div className="flex-1 flex flex-col items-center justify-center gap-2 opacity-40">
                          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                            <path d="M4 20V8a2 2 0 012-2h16a2 2 0 012 2v8a2 2 0 01-2 2H8l-4 4z" stroke="#ffffff" strokeWidth="1.6" strokeLinejoin="round" />
                          </svg>
                          <p className="text-[11px] text-[#ffffff] text-center">Chat preview will appear{"\n"}as you build your flow</p>
                        </div>
                      )}

                      {/* Timestamp — shown once any content exists */}
                      {(anyKeyword || keywords.length > 0 || showDmBubble) && (
                        <p className="text-[10px] text-[#444] text-center flex-shrink-0">Just now</p>
                      )}

                      {/* User keyword bubble — RIGHT, purple — shown when keyword(s) set */}
                      {(anyKeyword || keywords.length > 0) && (
                        triggerType === "STORY_REPLY" ? (
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <p className="text-[11px] text-[#8A8A8A] pr-1 mb-0.5">You replied to their story</p>
                            {(() => {
                              const post = allPosts.find(p => p.id === selectedPost);
                              return post?.thumbnailUrl ? (
                                <img src={post.thumbnailUrl} alt="" className="w-[85px] h-[140px] rounded-[14px] overflow-hidden border border-[#2C2D32] object-cover" />
                              ) : (
                                <div className="w-[85px] h-[140px] rounded-[14px] overflow-hidden border border-[#2C2D32]" style={{ background: post?.grad || 'linear-gradient(135deg, #2A2A35, #1E1F23)' }} />
                              );
                            })()}
                            <div className="bg-[#7D24CE] rounded-[18px_18px_4px_18px] px-3.5 py-2 text-[13px] text-white max-w-[70%] leading-[1.4] mt-1 break-all">
                              {anyKeyword ? "Replied to story ✨" : keywords[0]}
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-end flex-shrink-0">
                            <div className="bg-[#7D24CE] rounded-[18px_18px_4px_18px] px-3.5 py-2 text-[13px] text-white max-w-[70%] leading-[1.4] break-all">
                              {anyKeyword ? "Any comment" : keywords[0]}
                            </div>
                          </div>
                        )
                      )}

                      {/* Opening DM bubble — shown as soon as user is on DM step and has typed */}
                      {userHasReachedDmStep && openingDmOn && openingDmText.trim() && (
                        <div className="flex items-end gap-2 flex-shrink-0">
                          <div className="w-6 h-6 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center text-[10px] font-bold text-white" style={{ background: "linear-gradient(135deg,#833AB4,#FD1D1D,#FCB045)" }}>R</div>
                          <div style={{ background: "#1E1F23", borderRadius: "18px 18px 18px 4px", maxWidth: "80%" }} className="overflow-hidden">
                            <div className="px-3.5 pt-3 pb-2 text-[13px] text-white leading-[1.6] break-words">
                              {openingDmText}
                            </div>
                            {openingDmBtnLabel && (
                              <div className="px-3 pb-3">
                                <div style={{
                                  background: "#2C2D32",
                                  borderRadius: "10px",
                                  padding: "9px 12px",
                                  textAlign: "center",
                                  color: "white",
                                  fontWeight: 700,
                                  fontSize: "12px",
                                  letterSpacing: "0.05em",
                                  wordBreak: "break-all",
                                }}>
                                  {openingDmBtnLabel}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Follower taps the button — shown as a reply bubble on the right */}
                      {userHasReachedDmStep && openingDmOn && openingDmText.trim() && openingDmBtnLabel && (
                        <div className="flex justify-end flex-shrink-0">
                          <div className="bg-[#7D24CE] rounded-[18px_18px_4px_18px] px-3.5 py-2 text-[13px] text-white max-w-[70%] leading-[1.4] break-all">
                            {openingDmBtnLabel}
                          </div>
                        </div>
                      )}


                      {showDmBubble && askFollowOn && (
                        <>
                          <div className="flex items-end gap-2 flex-shrink-0">
                            <div className="w-6 h-6 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center text-[10px] font-bold text-white" style={{ background: "linear-gradient(135deg,#833AB4,#FD1D1D,#FCB045)" }}>R</div>
                            <div className="flex flex-col gap-1.5 max-w-[210px]">
                              <div style={{ background: "#1E1F23", borderRadius: "18px 18px 18px 4px" }}>
                                <div className="px-3.5 pt-3 pb-2 text-[13px] text-white leading-[1.6] break-words whitespace-pre-wrap">
                                  {askFollowText}
                                </div>
                                <div className="px-3 pb-3 space-y-2">
                                  <div style={{ background: "#2C2D32", borderRadius: "10px", padding: "9px 12px", textAlign: "center", color: "white", fontWeight: 700, fontSize: "12px", letterSpacing: "0.05em", wordBreak: "break-all" }}>
                                    Visit profile
                                  </div>
                                  <div style={{ background: "#2C2D32", borderRadius: "10px", padding: "9px 12px", textAlign: "center", color: "white", fontWeight: 700, fontSize: "12px", letterSpacing: "0.05em", wordBreak: "break-all" }}>
                                    I'm following
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex justify-end flex-shrink-0">
                            <div className="bg-[#7D24CE] rounded-[18px_18px_4px_18px] px-3.5 py-2 text-[13px] text-white max-w-[70%] leading-[1.4] break-all">
                              I'm following
                            </div>
                          </div>
                        </>
                      )}

                      {showDmBubble && leadOn && (
                        <>
                          <div className="flex items-end gap-2 flex-shrink-0">
                            <div className="w-6 h-6 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center text-[10px] font-bold text-white" style={{ background: "linear-gradient(135deg,#833AB4,#FD1D1D,#FCB045)" }}>R</div>
                            <div className="flex flex-col gap-1.5 max-w-[80%]">
                              <div className="bg-[#1E1F23] rounded-[18px_18px_18px_4px] px-3.5 py-2.5 text-[13px] text-white leading-[1.4] break-words">{leadText}</div>
                            </div>
                          </div>

                          <div className="flex justify-end flex-shrink-0">
                            <div className="bg-[#7D24CE] rounded-[18px_18px_4px_18px] px-3.5 py-2 text-[13px] text-white max-w-[70%] leading-[1.4] break-all">
                              riya@example.com |
                            </div>
                          </div>
                        </>
                      )}

                      {showDmBubble && (
                        <div className="flex items-end gap-2 flex-shrink-0">
                          <div className="w-6 h-6 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center text-[10px] font-bold text-white" style={{ background: "linear-gradient(135deg,#833AB4,#FD1D1D,#FCB045)" }}>R</div>
                          <div className="flex flex-col gap-1.5 max-w-[80%]">
                            {/* Unified card: message + inner rounded button */}
                            <div style={{ background: "#1E1F23", borderRadius: "18px 18px 18px 4px" }}>
                              <div className="px-3.5 pt-3 pb-2 text-[13px] text-white leading-[1.6] break-words">
                                {previewDm}
                              </div>
                              {linkLabel && (
                                <div className="px-3 pb-3">
                                  <div style={{
                                    background: "#2C2D32",
                                    borderRadius: "10px",
                                    padding: "9px 12px",
                                    textAlign: "center",
                                    color: "white",
                                    fontWeight: 700,
                                    fontSize: "12px",
                                    letterSpacing: "0.05em",
                                    wordBreak: "break-all",
                                  }}>
                                    {linkLabel}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {showDmBubble && followUpOn && (
                        <>
                          <p className="text-[10px] text-[#888] text-center flex-shrink-0 mt-3 mb-1">
                            Sent {followUpHours > 0 ? `${followUpHours}h ` : ''}{followUpMinutes}m later
                          </p>
                          <div className="flex items-end gap-2 flex-shrink-0">
                            <div className="w-6 h-6 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center text-[10px] font-bold text-white" style={{ background: "linear-gradient(135deg,#833AB4,#FD1D1D,#FCB045)" }}>R</div>
                            <div className="flex flex-col gap-1.5 max-w-[80%]">
                              <div className="bg-[#1E1F23] rounded-[18px_18px_18px_4px] px-3.5 py-2.5 text-[13px] text-white leading-[1.4] break-words whitespace-pre-wrap">
                                {followUpText}
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Message input bar */}
                    <div className="bg-[#212121] px-1.5 py-1.5 flex items-center gap-2.5 flex-shrink-0" style={{ borderRadius: '32px', margin: '3%' }}>
                      <div className="w-8 h-8 rounded-full bg-[#ffffff] flex items-center justify-center flex-shrink-0">
                        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                          <circle cx="6.5" cy="6.5" r="4" stroke="#464DDB" strokeWidth="1.9" />
                          <path d="M10.5 10.5l2.5 2.5" stroke="#464DDB" strokeWidth="1.9" strokeLinecap="round" />
                        </svg>
                      </div>
                      <div className="flex-1 text-[14px] text-[#777777]">Message...</div>
                      <div className="w-10 h-8 rounded-full bg-[#454EDB] flex items-center justify-center flex-shrink-0">
                        <img src="/zepply chat ui icons/send.png" alt="" className="w-4 h-4 object-contain" />
                      </div>
                    </div>
                  </div>

                </div>
              </div>

              {/* iPhone frame PNG — on top of screen content */}
              <img
                src="/zepply chat ui icons/iphone-Frame.png"
                alt=""
                className="absolute inset-0 w-full h-full pointer-events-none select-none"
                style={{ zIndex: 10 }}
              />
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
      {/* ── SUCCESS OVERLAY ── */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center" style={{ background: "linear-gradient(135deg,#16A34A,#22C55E)", animation: "fade-in 0.4s ease-out forwards" }}>
          <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mb-6" style={{ animation: "pop-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards", opacity: 0, animationDelay: "0.1s" }}>
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <path d="M8 20L16 28L32 12" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="60" strokeDashoffset="60" style={{ animation: "draw-check 0.4s ease-out forwards", animationDelay: "0.4s" }} />
            </svg>
          </div>
          <h2 className="text-[26px] font-extrabold text-white mb-2" style={{ animation: "fade-in 0.4s ease-out forwards", opacity: 0, animationDelay: "0.3s" }}>Automation activated!</h2>
          <p className="text-[14px] text-white/80 mb-8" style={{ animation: "fade-in 0.4s ease-out forwards", opacity: 0, animationDelay: "0.4s" }}>{autoName} is now live</p>
          <div className="flex gap-3" style={{ animation: "fade-in 0.4s ease-out forwards", opacity: 0, animationDelay: "0.5s" }}>
            <button onClick={() => router.push("/dashboard/triggers")} className="px-6 py-3 border-2 border-white/50 rounded-full text-white font-semibold text-[14px] hover:bg-white/10 transition-colors">
              View Automations
            </button>
            <button onClick={() => router.push("/dashboard")} className="px-6 py-3 bg-white rounded-full text-[#16A34A] font-bold text-[14px] hover:opacity-90 transition-opacity">
              Go to Dashboard
            </button>
          </div>
        </div>
      )}
      {/* ── POSTS MODAL ── */}
      {showPostsModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
          <div className="bg-white rounded-[20px] shadow-2xl w-[90%] max-w-[800px] max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-[#E5E7EB]">
              <div>
                <h3 className="text-[18px] font-bold text-[#0F1B4C]">{isStoryReply ? "Select a Story" : "Select a Post"}</h3>
                <p className="text-[13px] text-[#6B7280]">{isStoryReply ? "Choose which story will trigger this automation" : "Choose which post will trigger this automation"}</p>
              </div>
              <button onClick={() => setShowPostsModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#F3F4F6] text-[#6B7280] transition-colors">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              </button>
            </div>

            {!isStoryReply && (
              <div className="flex items-center gap-6 px-6 pt-4 border-b border-[#E5E7EB]">
                {["All", "Reels", "Posts", "Carousels"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setPostFilter(f)}
                    className={`pb-3 text-[14px] font-bold relative transition-colors ${postFilter === f ? "text-[#000000]" : "text-[#8A8A8A] hover:text-[#000000]"}`}
                  >
                    {f}
                    {postFilter === f && (
                      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#000000]" />
                    )}
                  </button>
                ))}
              </div>
            )}

            <div className="p-6 overflow-y-auto bg-[#F9FAFB] flex-1">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {allPosts.filter(p => isStoryReply || postFilter === "All" || p.type + "s" === postFilter || p.type === postFilter).map((post) => (
                  <div
                    key={post.id}
                    onClick={() => {
                      setSelectedPost(post.id);
                      setShowPostsModal(false);
                    }}
                    className={`relative cursor-pointer rounded-xl overflow-hidden border-2 transition-all group bg-white shadow-sm hover:shadow-md ${selectedPost === post.id ? 'border-[#2564FF]' : 'border-transparent hover:border-[#D1D5DB]'}`}
                  >
                    <div style={{ aspectRatio: '3/4' }} className="w-full relative overflow-hidden">
                      {post.thumbnailUrl ? (
                        <img src={post.thumbnailUrl} alt={post.caption} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full" style={{ background: post.grad }} />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="p-2.5">
                      <p className="text-[12px] font-bold text-[#0F1B4C] line-clamp-2 leading-tight mb-1.5">{post.caption}</p>
                      <div className="flex items-center justify-between text-[10px] text-[#6B7280]">
                        <span>{post.date}</span>
                        <div className="flex items-center gap-1">
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor"><path d="M6 11.5L1.5 7C.5 6 0 4.8 0 3.5c0-2 1.5-3.5 3.5-3.5 1 0 2 .5 2.5 1.2C6.5.5 7.5 0 8.5 0 10.5 0 12 1.5 12 3.5c0 1.3-.5 2.5-1.5 3.5L6 11.5z" /></svg>
                          {post.likes}
                        </div>
                      </div>
                    </div>
                    {selectedPost === post.id && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-[#2564FF] rounded-full flex items-center justify-center shadow-md">
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ── REPLY MODAL ── */}
      {showReplyModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
          <div className="bg-white rounded-[20px] shadow-2xl w-[90%] max-w-[340px] p-5">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-[17px] font-bold text-[#000000]">
                {replyModalMode === "add" ? "Add public reply" : "Edit public reply"}
              </h3>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8A8A8A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </div>

            <div className="relative">
              <textarea
                value={replyModalText}
                onChange={(e) => setReplyModalText(e.target.value)}
                className="w-full h-[120px] border border-[#B0B0B0] rounded-[12px] p-3 pb-10 text-[14px] text-[#000000] resize-none outline-none focus:border-[#2564FF] transition-colors"
                autoFocus
              />
              <div className="absolute bottom-3 left-3 text-[#2564FF]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                  <line x1="9" y1="9" x2="9.01" y2="9"></line>
                  <line x1="15" y1="9" x2="15.01" y2="9"></line>
                </svg>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={() => setShowReplyModal(false)}
                className="flex-1 py-2.5 bg-[#A8A8A8] text-white rounded-md text-[14px] font-bold hover:bg-[#999999] transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={replyModalMode === "add" ? !replyModalText.trim() : (!replyModalText.trim() || replyModalText.trim() === publicReplies[replyModalIndex as number]?.trim())}
                onClick={() => {
                  if (!replyModalText.trim()) return;
                  if (replyModalMode === "add") {
                    setPublicReplies([...publicReplies, replyModalText.trim()]);
                  } else if (replyModalIndex !== null) {
                    const updated = [...publicReplies];
                    updated[replyModalIndex] = replyModalText.trim();
                    setPublicReplies(updated);
                  }
                  setShowReplyModal(false);
                }}
                className={`flex-1 py-2.5 rounded-md text-[14px] font-bold transition-colors ${(replyModalMode === "add" ? !!replyModalText.trim() : (!!replyModalText.trim() && replyModalText.trim() !== publicReplies[replyModalIndex as number]?.trim())) ? "bg-[#2564FF] text-white hover:bg-[#1D4ED8]" : "bg-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed"}`}
              >
                {replyModalMode === "add" ? "Add Reply" : "Update Reply"}
              </button>
            </div>
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

  return (
    <div
      id={`step-card-${id}`}
      className="bg-white rounded-2xl mb-3 overflow-hidden"
      style={{ border: '1px solid #9F9F9F' }}
    >
      {/* Card header */}
      <div
        className="flex items-center gap-3 px-4 py-4"
        style={{ cursor: isDone && !isCurrent ? 'pointer' : 'default' }}
        onClick={isDone && !isCurrent ? onEdit : undefined}
      >
        {/* Number / check circle */}
        <div
          className="flex-shrink-0 flex items-center justify-center text-[14px] font-bold"
          style={{
            width: 24, height: 24, borderRadius: '50%',
            background: isCurrent ? '#2564FF' : isDone ? '#2564FF' : '#D9D9D9',
            color: isCurrent || isDone ? '#FFFFFF' : '#606060',
          }}
        >
          {isDone && !isCurrent ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : id}
        </div>
        <p
          className="flex-1 text-[16px] font-bold"
          style={{ color: isCurrent ? '#000000' : isDone ? '#000000' : '#8A8A8A' }}
        >
          {label}
        </p>
        {isDone && !isCurrent && (
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="text-[13px] font-semibold"
            style={{ color: '#2564FF' }}
          >
            Edit
          </button>
        )}
      </div>

      {/* Expanded content */}
      {isCurrent && (
        <div className="px-4 pb-5" style={{ borderTop: '1px solid #F3F3F3' }}>
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
      style={{
        position: "relative",
        width: "36px",
        height: "20px",
        borderRadius: "10px",
        backgroundColor: on ? (green ? "#22C55E" : "#3D7EFF") : "#D1D5DB",
        border: "none",
        cursor: "pointer",
        flexShrink: 0,
        transition: "background-color 0.2s",
        padding: 0,
        overflow: "hidden",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: "3px",
          left: "3px",
          width: "14px",
          height: "14px",
          borderRadius: "50%",
          backgroundColor: "white",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          transform: on ? "translateX(16px)" : "translateX(0px)",
          transition: "transform 0.2s ease",
        }}
      />
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
