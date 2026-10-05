"use client";

import { useState, useEffect } from "react";
import { X, MessageCircle, Zap, Users, Image, ChevronRight, Check, Loader2 } from "lucide-react";

// ─── Types ─────────────────────────────────────────────────
interface IGPost {
  id: string;
  caption: string;
  mediaType: string;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  permalink: string | null;
  timestamp: string;
}

interface TriggerFormData {
  type: string;
  keywords: string[];
  replyMessage: string;
  deliverLink: string;
  followGate: boolean;
  postScope: "specific" | "next" | "any";
  selectedPostId: string | null;
}

interface TriggerSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: TriggerFormData) => Promise<void>;
  initialData?: Partial<TriggerFormData>;
  igAccountId: string;
}

// ─── Template Cards ────────────────────────────────────────
const templates = [
  {
    type: "COMMENT",
    title: "Comment to DM Flow",
    badge: "quick",
    description: "Automatically reply to comments and send personalized DMs",
    icon: MessageCircle,
    gradient: "from-purple-500 to-pink-500",
  },
  {
    type: "STORY_REPLY",
    title: "Story Reply Flow",
    badge: "quick",
    description: "Respond to story replies and convert viewers into customers",
    icon: Image,
    gradient: "from-orange-500 to-pink-500",
  },
  {
    type: "NEW_FOLLOWER",
    title: "Welcome New Followers",
    badge: "quick",
    description: "Auto-welcome new followers with a personalized DM",
    icon: Users,
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    type: "DM_KEYWORD",
    title: "DM Auto Responder",
    badge: "quick",
    description: "Automatically reply to DMs with keyword-based responses",
    icon: Zap,
    gradient: "from-green-500 to-emerald-500",
  },
];

const defaults: TriggerFormData = {
  type: "",
  keywords: [],
  replyMessage: "",
  deliverLink: "",
  followGate: false,
  postScope: "any",
  selectedPostId: null,
};

// ─── Main Component ────────────────────────────────────────
export function TriggerSlideOver({
  isOpen,
  onClose,
  onSave,
  initialData,
  igAccountId,
}: TriggerSlideOverProps) {
  // Steps: 0 = template picker, 1 = post selection, 2 = keywords, 3 = DM config
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<TriggerFormData>({ ...defaults, ...initialData });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Instagram posts
  const [posts, setPosts] = useState<IGPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);

  // Keywords
  const [keywordInput, setKeywordInput] = useState("");
  const [anyKeyword, setAnyKeyword] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialData?.type) {
        setForm({ ...defaults, ...initialData });
        setStep(1);
      } else {
        setForm(defaults);
        setStep(0);
      }
      setError("");
    }
  }, [isOpen, initialData]);

  // Fetch posts when entering step 1 for COMMENT type
  useEffect(() => {
    if (step === 1 && form.type === "COMMENT" && posts.length === 0) {
      fetchPosts();
    }
  }, [step, form.type]);

  const fetchPosts = async () => {
    setLoadingPosts(true);
    try {
      const res = await fetch("/api/instagram/media");
      if (res.ok) {
        const data = await res.json();
        setPosts(data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch posts:", err);
    } finally {
      setLoadingPosts(false);
    }
  };

  const selectTemplate = (type: string) => {
    setForm({ ...defaults, type });
    // COMMENT flow has post selection, others skip to keywords
    if (type === "COMMENT") {
      setStep(1);
    } else if (type === "NEW_FOLLOWER") {
      setStep(3); // Skip to DM config
    } else {
      setStep(2); // Go to keywords
    }
  };

  const addKeyword = () => {
    const trimmed = keywordInput.trim().toUpperCase();
    if (trimmed && !form.keywords.includes(trimmed)) {
      setForm({ ...form, keywords: [...form.keywords, trimmed] });
    }
    setKeywordInput("");
  };

  const removeKeyword = (keyword: string) => {
    setForm({ ...form, keywords: form.keywords.filter((k) => k !== keyword) });
  };

  const handleSubmit = async () => {
    setError("");
    if (!form.replyMessage.trim()) {
      setError("Reply message is required");
      return;
    }

    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save trigger");
    } finally {
      setSaving(false);
    }
  };

  const getStepCount = () => {
    if (form.type === "COMMENT") return 3; // post → keywords → DM
    if (form.type === "NEW_FOLLOWER") return 1; // DM only
    return 2; // keywords → DM
  };

  const getCurrentStepLabel = () => {
    if (step === 0) return "Choose Template";
    if (step === 1) return "Select a Post";
    if (step === 2) return "Add Keywords";
    return "Configure DM";
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-white dark:bg-gray-950 z-50 shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {step === 0 ? "Choose a Template" : initialData ? "Edit Trigger" : "New Automation"}
              </h2>
              {step > 0 && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {getCurrentStepLabel()} • Step {step} of {getStepCount()}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress bar */}
          {step > 0 && (
            <div className="mt-3 h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500 rounded-full"
                style={{ width: `${(step / getStepCount()) * 100}%` }}
              />
            </div>
          )}
        </div>

        <div className="p-6">
          {/* ─── Step 0: Template Picker ─── */}
          {step === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Pick the type of automation you want to build
              </p>
              {templates.map((tpl) => (
                <button
                  key={tpl.type}
                  onClick={() => selectTemplate(tpl.type)}
                  className="w-full text-left group"
                >
                  <div className="flex items-start gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-purple-300 dark:hover:border-purple-700 hover:bg-purple-50/50 dark:hover:bg-purple-900/10 transition-all">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tpl.gradient} flex items-center justify-center flex-shrink-0`}>
                      <tpl.icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                          {tpl.title}
                        </h3>
                        <span className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">
                          {tpl.badge}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {tpl.description}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-purple-500 transition-colors mt-1" />
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* ─── Step 1: Post Selection (Comment only) ─── */}
          {step === 1 && form.type === "COMMENT" && (
            <div className="space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs flex items-center justify-center">1</span>
                  Select a Post
                </h3>

                {/* Post scope radio */}
                <div className="space-y-2 mb-4">
                  {[
                    { value: "specific" as const, label: "Specific Post", desc: "Select from existing posts" },
                    { value: "next" as const, label: "Next Post", desc: "Activate on your next post" },
                    { value: "any" as const, label: "Any Post", desc: "Works on all posts" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setForm({ ...form, postScope: option.value, selectedPostId: null })}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                        form.postScope === option.value
                          ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 ring-1 ring-purple-500/30"
                          : "border-gray-200 dark:border-gray-800 hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          form.postScope === option.value
                            ? "border-purple-600 bg-purple-600"
                            : "border-gray-300 dark:border-gray-600"
                        }`}>
                          {form.postScope === option.value && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{option.label}</p>
                          <p className="text-xs text-gray-400">{option.desc}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Post grid (only for specific) */}
                {form.postScope === "specific" && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Choose a Post:</p>
                    {loadingPosts ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
                        <span className="ml-2 text-sm text-gray-400">Loading your posts...</span>
                      </div>
                    ) : posts.length === 0 ? (
                      <div className="text-center py-8 text-sm text-gray-400">
                        No posts found. Make sure your Instagram account has posts.
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {posts.map((post) => (
                          <button
                            key={post.id}
                            onClick={() => setForm({ ...form, selectedPostId: post.id })}
                            className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                              form.selectedPostId === post.id
                                ? "border-purple-500 ring-2 ring-purple-500/30 scale-[0.97]"
                                : "border-transparent hover:border-gray-300"
                            }`}
                          >
                            <img
                              src={post.thumbnailUrl || post.mediaUrl || "/globe.svg"}
                              alt={post.caption?.substring(0, 30) || "Post"}
                              className="w-full h-full object-cover"
                            />
                            {/* Selected overlay */}
                            {form.selectedPostId === post.id && (
                              <div className="absolute inset-0 bg-purple-600/30 flex items-center justify-center">
                                <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center">
                                  <Check className="w-5 h-5 text-white" />
                                </div>
                              </div>
                            )}
                            {/* Media type badge */}
                            {post.mediaType === "VIDEO" && (
                              <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-black/60 rounded text-[10px] text-white font-medium">
                                REEL
                              </div>
                            )}
                            {post.mediaType === "CAROUSEL_ALBUM" && (
                              <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-black/60 rounded text-[10px] text-white font-medium">
                                ALBUM
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Next button */}
              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
                <button onClick={() => setStep(0)} className="flex-1 px-4 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 rounded-xl">
                  Back
                </button>
                <button
                  onClick={() => setStep(2)}
                  disabled={form.postScope === "specific" && !form.selectedPostId}
                  className="flex-1 px-4 py-3 text-sm font-semibold text-white bg-purple-600 rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ─── Step 2: Keywords ─── */}
          {step === 2 && (
            <div className="space-y-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs flex items-center justify-center">
                  {form.type === "COMMENT" ? "2" : "1"}
                </span>
                Add Keywords
              </h3>

              {/* Any keyword toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-800">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Any keyword</p>
                  <p className="text-xs text-gray-400">Trigger on any {form.type === "COMMENT" ? "comment" : "DM"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAnyKeyword(!anyKeyword);
                    if (!anyKeyword) setForm({ ...form, keywords: [] });
                  }}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    anyKeyword ? "bg-purple-600" : "bg-gray-200 dark:bg-gray-700"
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    anyKeyword ? "translate-x-5" : ""
                  }`} />
                </button>
              </div>

              {/* Keyword input */}
              {!anyKeyword && (
                <div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={keywordInput}
                      onChange={(e) => setKeywordInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addKeyword())}
                      placeholder="Type keyword..."
                      className="flex-1 px-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                    />
                    <button
                      type="button"
                      onClick={addKeyword}
                      className="px-4 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors text-sm font-medium"
                    >
                      +
                    </button>
                  </div>

                  {/* Keywords list */}
                  {form.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {form.keywords.map((kw) => (
                        <span
                          key={kw}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg text-sm font-medium"
                        >
                          {kw}
                          <button onClick={() => removeKeyword(kw)} className="hover:text-red-500">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-gray-400 mt-2">
                    When someone {form.type === "COMMENT" ? "comments" : "DMs"} any of these words, Zepply triggers instantly.
                  </p>
                </div>
              )}

              {/* Next button */}
              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
                <button
                  onClick={() => setStep(form.type === "COMMENT" ? 1 : 0)}
                  className="flex-1 px-4 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 rounded-xl"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!anyKeyword && form.keywords.length === 0}
                  className="flex-1 px-4 py-3 text-sm font-semibold text-white bg-purple-600 rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ─── Step 3: DM Configuration ─── */}
          {step === 3 && (
            <div className="space-y-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs flex items-center justify-center">
                  {form.type === "COMMENT" ? "3" : form.type === "NEW_FOLLOWER" ? "1" : "2"}
                </span>
                {form.type === "NEW_FOLLOWER" ? "Welcome Message" : "Send DM Message"}
              </h3>

              {/* Reply message */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Message
                </label>
                <textarea
                  value={form.replyMessage}
                  onChange={(e) => setForm({ ...form, replyMessage: e.target.value })}
                  maxLength={500}
                  rows={4}
                  placeholder={
                    form.type === "NEW_FOLLOWER"
                      ? "Hey! Thanks for following 🙌 I share helpful tips here..."
                      : "Hey! Here's the link you asked for 👉"
                  }
                  className="w-full px-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none"
                />
                <p className="text-xs text-gray-400 text-right mt-1">{form.replyMessage.length}/500</p>
              </div>

              {/* Deliver link */}
              <div className="p-3 rounded-xl border border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Deliver a Link</p>
                    <p className="text-xs text-gray-400">Append a link to the DM</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, deliverLink: form.deliverLink ? "" : "https://" })}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      form.deliverLink ? "bg-purple-600" : "bg-gray-200 dark:bg-gray-700"
                    }`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      form.deliverLink ? "translate-x-5" : ""
                    }`} />
                  </button>
                </div>
                {form.deliverLink && (
                  <input
                    type="url"
                    value={form.deliverLink}
                    onChange={(e) => setForm({ ...form, deliverLink: e.target.value })}
                    placeholder="https://your-link.com/guide"
                    className="w-full px-3 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  />
                )}
              </div>

              {/* Follow gate (Comment only) */}
              {form.type === "COMMENT" && (
                <div className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-800">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Follow Gate</p>
                    <p className="text-xs text-gray-400">Only reply if commenter follows you</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, followGate: !form.followGate })}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      form.followGate ? "bg-purple-600" : "bg-gray-200 dark:bg-gray-700"
                    }`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      form.followGate ? "translate-x-5" : ""
                    }`} />
                  </button>
                </div>
              )}

              {/* Pro features stub */}
              <div className="space-y-3 pt-3 border-t border-gray-200 dark:border-gray-800">
                <div className="opacity-40 pointer-events-none flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-800">
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Use AI Reply</p>
                    <p className="text-xs text-gray-400">Pro — coming soon</p>
                  </div>
                  <div className="relative w-11 h-6 rounded-full bg-gray-200 dark:bg-gray-700">
                    <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow" />
                  </div>
                </div>
              </div>

              {/* Error */}
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => {
                    if (form.type === "NEW_FOLLOWER") setStep(0);
                    else setStep(2);
                  }}
                  className="flex-1 px-4 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 rounded-xl"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={saving || !form.replyMessage.trim()}
                  className="flex-1 px-4 py-3 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-500 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                  ) : (
                    <>{initialData ? "Update" : "Go Live"} 🚀</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
